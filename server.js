const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { randomBytes, pbkdf2Sync, timingSafeEqual, createHash } = require('crypto');
const { URL } = require('url');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const storage = require('./storage');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
let mailTransport = null;
let stripeClient = null;
const stripePriceCache = new Map();
const urlMatchRegex = /((https?:\/\/|www\.)[^\s]+)/i;

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  try {
    if (!fs.existsSync(envPath)) {
      return;
    }
    const contents = fs.readFileSync(envPath, 'utf8');
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .forEach((line) => {
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) return;
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
  } catch (err) {
    console.warn('Failed to load .env file', err);
  }
}

loadDotEnv();

async function initialiseStorage() {
  await storage.initStorage(DATA_DIR);
  storage.migrateLegacyUsers(USERS_FILE);
}

function hashPassword(password, salt) {
  const effectiveSalt = salt || randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, effectiveSalt, 120000, 64, 'sha512');
  return `${effectiveSalt}:${hash.toString('hex')}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashValue] = parts;
  const derived = pbkdf2Sync(password, salt, 120000, 64, 'sha512');
  const stored = Buffer.from(hashValue, 'hex');
  return stored.length === derived.length && timingSafeEqual(derived, stored);
}

function readRequestBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        const err = new Error('Payload too large');
        err.code = 'PAYLOAD_TOO_LARGE';
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function parseCookies(header = '') {
  const result = {};
  if (!header) return result;
  const parts = header.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch (err) {
      result[key] = value;
    }
  }
  return result;
}

async function readJsonBody(req, limit) {
  const raw = await readRequestBody(req, limit);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    const error = new Error('Invalid JSON');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()');
}

function createSession(userId) {
  const token = randomBytes(24).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  storage.createSession({ token, userId, expiresAt });
  return { token, expiresAt };
}

function getSession(token) {
  if (!token) return null;
  const record = storage.getSession(token);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    storage.deleteSession(token);
    return null;
  }
  return record;
}

function deleteSession(token) {
  if (token) {
    storage.deleteSession(token);
  }
}

function shouldUseSecureCookies() {
  if (process.env.COOKIE_SECURE === 'true') {
    return true;
  }
  if (process.env.COOKIE_SECURE === 'false') {
    return false;
  }
  return process.env.NODE_ENV === 'production';
}

function buildSessionCookie(value, maxAgeSeconds) {
  const tokenValue = encodeURIComponent(value || '');
  const attributes = [
    `session=${tokenValue}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'SameSite=Lax',
  ];
  if (shouldUseSecureCookies()) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}

function stripTrailingPunctuation(str) {
  return str.replace(/[),.?!'"\]]+$/gu, '');
}

function detectFirstUrl(text) {
  if (!text) return null;
  const match = text.match(urlMatchRegex);
  if (!match) return null;
  return stripTrailingPunctuation(match[0]);
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) return null;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function canonicalPayloadValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const detectedUrl = detectFirstUrl(trimmed);
  const normalizedUrl = detectedUrl ? normalizeUrl(detectedUrl) : null;
  return {
    payloadText: trimmed,
    normalizedValue: normalizedUrl || trimmed,
    targetUrl: normalizedUrl,
  };
}

function buildPayloadHash(normalizedValue) {
  return createHash('sha256').update(normalizedValue).digest('hex');
}

function mapSoundLinkForClient(row) {
  const scanEvents24h = Array.isArray(row.scanEvents24h)
    ? row.scanEvents24h
        .map((value) => Date.parse(value))
        .filter((value) => Number.isFinite(value))
    : [];
  return {
    id: row.id,
    payloadText: row.payloadText,
    payloadKeyHash: row.payloadKeyHash,
    targetUrl: row.targetUrl || null,
    scanCount: Number(row.scanCount) || 0,
    lastScanAt: row.lastScanAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    scanEvents24h,
  };
}

const ANALYTICS_RANGE_MS = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function parseAnalyticsRange(value) {
  return Object.prototype.hasOwnProperty.call(ANALYTICS_RANGE_MS, value) ? value : '24h';
}

function parseAnalyticsBucket(value, range) {
  if (value === 'hour' || value === 'day') {
    return value;
  }
  return range === '24h' ? 'hour' : 'day';
}

function parseAnalyticsLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(50, Math.max(1, Math.round(parsed)));
}

function parseAnalyticsLinkId(value) {
  if (!value || value === 'all') return null;
  return String(value);
}

function alignDateToBucket(date, bucket) {
  const aligned = new Date(date.getTime());
  if (bucket === 'day') {
    aligned.setUTCHours(0, 0, 0, 0);
    return aligned;
  }
  aligned.setUTCMinutes(0, 0, 0);
  return aligned;
}

function getBucketDurationMs(bucket) {
  return bucket === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
}

function buildAnalyticsWindowMeta(range, bucket) {
  const durationMs = ANALYTICS_RANGE_MS[range] || ANALYTICS_RANGE_MS['24h'];
  const now = new Date();
  let end = alignDateToBucket(now, bucket);
  if (end.getTime() <= now.getTime()) {
    end = new Date(end.getTime() + getBucketDurationMs(bucket));
  }
  const endMs = end.getTime();
  const startMs = endMs - durationMs;
  const previousEndMs = startMs;
  const previousStartMs = previousEndMs - durationMs;
  return {
    range,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    previousStartIso: new Date(previousStartMs).toISOString(),
    previousEndIso: new Date(previousEndMs).toISOString(),
  };
}

function getMailTransport() {
  if (mailTransport !== null) {
    return mailTransport || null;
  }

  const { SMTP_HOST } = process.env;
  if (!SMTP_HOST) {
    console.info('SMTP_HOST not configured — welcome emails disabled.');
    mailTransport = false;
    return null;
  }

  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const secure =
    process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;

  try {
    mailTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: port || (secure ? 465 : 587),
      secure,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
    });
  } catch (err) {
    console.error('Failed to configure mail transport', err);
    mailTransport = false;
    return null;
  }

  return mailTransport;
}

async function sendWelcomeEmail(user) {
  const transport = getMailTransport();
  if (!transport) return;

  const from = process.env.SMTP_FROM || 'AudioLink <no-reply@audiolink.local>';
  const dashboardUrl =
    process.env.APP_DASHBOARD_URL || 'http://127.0.0.1:3000/new/admin.html';
  const subject = process.env.WELCOME_EMAIL_SUBJECT || 'Welcome to AudioLink';
  const plainText = [
    `Hi ${user.email},`,
    '',
    'Thanks for creating an AudioLink Studio account.',
    `You can jump back into your dashboard any time: ${dashboardUrl}`,
    '',
    'Happy linking!',
    '— The AudioLink team',
  ].join('\n');

  const htmlBody = `
    <p>Hi ${user.email},</p>
    <p>Thanks for creating an <strong>AudioLink Studio</strong> account.</p>
    <p><a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer">Open your dashboard</a> to start generating sound links right away.</p>
    <p>Happy linking!<br />— The AudioLink team</p>
  `;

  try {
    await transport.sendMail({
      to: user.email,
      from,
      subject,
      text: plainText,
      html: htmlBody,
    });
    console.log(`Sent welcome email to ${user.email}`);
  } catch (err) {
    console.error('Failed to send welcome email', err);
  }
}

function getStripeClient() {
  if (stripeClient !== null) {
    return stripeClient;
  }
  const { STRIPE_SECRET_KEY } = process.env;
  if (!STRIPE_SECRET_KEY) {
    stripeClient = false;
    console.info('STRIPE_SECRET_KEY not set — checkout disabled.');
    return null;
  }
  try {
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  } catch (err) {
    console.error('Failed to initialise Stripe client', err);
    stripeClient = false;
    return null;
  }
  return stripeClient;
}

async function resolveStripePriceId(stripe) {
  const explicitPrice =
    process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRICE_ID || process.env.STRIPE_DEFAULT_PRICE_ID;
  if (explicitPrice) {
    return explicitPrice;
  }
  const productId =
    process.env.STRIPE_PRO_PRODUCT_ID ||
    process.env.STRIPE_PRODUCT_ID ||
    process.env.STRIPE_DEFAULT_PRODUCT_ID;
  if (!productId) {
    return null;
  }
  if (stripePriceCache.has(productId)) {
    return stripePriceCache.get(productId);
  }
  try {
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 1,
      expand: ['data.product'],
    });
    const price = prices.data.find((item) => item.active);
    if (price) {
      stripePriceCache.set(productId, price.id);
      return price.id;
    }
    console.warn(`No active prices found for Stripe product ${productId}`);
  } catch (err) {
    console.error('Failed to resolve Stripe price', err);
    throw err;
  }
  return null;
}

async function syncStripeSubscription(user) {
  const billing = {
    plan: user.plan || 'free',
    planUpdatedAt: user.planUpdatedAt || null,
    stripeCustomerId: user.stripeCustomerId || null,
    stripeSubscriptionId: user.stripeSubscriptionId || null,
    stripeSubscriptionStatus: user.stripeSubscriptionStatus || null,
    stripeSubscriptionPeriodEnd: user.stripeSubscriptionPeriodEnd || null,
  };
  if (!user.stripeSubscriptionId) {
    return billing;
  }
  const stripe = getStripeClient();
  if (!stripe) {
    return billing;
  }
  try {
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['latest_invoice', 'plan', 'items.data.price'],
    });
    if (!subscription) {
      return billing;
    }
    const status = subscription.status || null;
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    if (!periodEnd) {
      console.warn('Stripe subscription missing current_period_end', {
        status,
        subscriptionId: user.stripeSubscriptionId,
      });
    }
    const plan =
      status && (status === 'active' || status === 'trialing' || status === 'past_due')
        ? 'pro'
        : 'free';
    const customerId =
      (subscription.customer && typeof subscription.customer === 'object'
        ? subscription.customer.id
        : null) ||
      (typeof subscription.customer === 'string' ? subscription.customer : user.stripeCustomerId);
    const planUpdatedAt = new Date().toISOString();
    const hasChanges =
      plan !== user.plan ||
      status !== user.stripeSubscriptionStatus ||
      periodEnd !== user.stripeSubscriptionPeriodEnd ||
      customerId !== user.stripeCustomerId;
    if (hasChanges) {
      storage.updateUserPlan(user.id, {
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        stripeSubscriptionStatus: status,
        stripeSubscriptionPeriodEnd: periodEnd,
        planUpdatedAt,
      });
      user.plan = plan;
      user.planUpdatedAt = planUpdatedAt;
      user.stripeCustomerId = customerId;
      user.stripeSubscriptionStatus = status;
      user.stripeSubscriptionPeriodEnd = periodEnd;
      billing.plan = plan;
      billing.planUpdatedAt = planUpdatedAt;
      billing.stripeCustomerId = customerId;
      billing.stripeSubscriptionStatus = status;
      billing.stripeSubscriptionPeriodEnd = periodEnd;
    } else {
      billing.plan = plan;
      billing.planUpdatedAt = user.planUpdatedAt || planUpdatedAt;
      billing.stripeCustomerId = customerId;
      billing.stripeSubscriptionStatus = status;
      billing.stripeSubscriptionPeriodEnd = periodEnd;
    }
  } catch (err) {
    console.error('Failed to synchronise Stripe subscription', err);
  }
  return billing;
}

async function handleApiRequest(req, res) {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  } catch (err) {
    sendJson(res, 400, { error: 'Bad Request' });
    return;
  }
  const route = url.pathname;
  const method = req.method.toUpperCase();
  const cookies = parseCookies(req.headers.cookie);
  storage.purgeExpiredSessions(Date.now());
  const activeSession = getSession(cookies.session);

  if (route === '/api/session' && method === 'GET') {
    if (!activeSession) {
      sendJson(res, 200, { authenticated: false });
      return;
    }
    const user = storage.getUserById(activeSession.userId);
    if (!user) {
      deleteSession(cookies.session);
      sendJson(res, 200, { authenticated: false });
      return;
    }
    sendJson(res, 200, {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        plan: user.plan || 'free',
        planUpdatedAt: user.planUpdatedAt || null,
        stripeSubscriptionStatus: user.stripeSubscriptionStatus || null,
        stripeSubscriptionPeriodEnd: user.stripeSubscriptionPeriodEnd || null,
      },
    });
    return;
  }

  if (route === '/api/checkout/pro' && method === 'POST') {
    const stripe = getStripeClient();
    if (!stripe) {
      sendJson(res, 503, { error: 'Stripe is not configured.' });
      return;
    }
    let priceId = process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      try {
        priceId = await resolveStripePriceId(stripe);
      } catch (err) {
        sendJson(res, 502, { error: 'Unable to start checkout.' });
        return;
      }
    }
    if (!priceId) {
      sendJson(res, 503, { error: 'Stripe price is not configured.' });
      return;
    }
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'Payload too large.' });
        return;
      }
      if (err && err.code === 'INVALID_JSON') {
        sendJson(res, 400, { error: 'Invalid JSON payload.' });
        return;
      }
      console.warn('Failed to parse checkout payload', err);
    }
    const protoHeader = req.headers['x-forwarded-proto'];
    const protocol = typeof protoHeader === 'string' ? protoHeader.split(',')[0].trim() : 'http';
    const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : `${HOST}:${PORT}`;
    const origin = `${protocol}://${hostHeader}`;
    const successUrl =
      process.env.STRIPE_SUCCESS_URL || `${origin}/new/admin.html?checkout=success`;
    const cancelUrl =
      process.env.STRIPE_CANCEL_URL || `${origin}/new/index.html?checkout=cancelled`;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        customer_email: payload.email || undefined,
        metadata: {
          plan: 'pro',
        },
      });
      sendJson(res, 200, { url: session.url });
    } catch (err) {
      console.error('Stripe checkout session failed', err);
      sendJson(res, 502, { error: 'Unable to start checkout.' });
    }
    return;
  }

  if (route === '/api/billing/status' && method === 'GET') {
    if (!activeSession) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const user = storage.getUserById(activeSession.userId);
    if (!user) {
      deleteSession(cookies.session);
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const billing = await syncStripeSubscription(user);
    sendJson(res, 200, billing);
    return;
  }

  if (route === '/api/billing/confirm' && method === 'POST') {
    if (!activeSession) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const stripe = getStripeClient();
    if (!stripe) {
      sendJson(res, 503, { error: 'Stripe is not configured.' });
      return;
    }
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'Payload too large.' });
        return;
      }
      if (err && err.code === 'INVALID_JSON') {
        sendJson(res, 400, { error: 'Invalid JSON payload.' });
        return;
      }
      console.warn('Failed to parse billing confirmation payload', err);
    }
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId.trim() : '';
    if (!sessionId) {
      sendJson(res, 400, { error: 'A valid sessionId is required.' });
      return;
    }
    const user = storage.getUserById(activeSession.userId);
    if (!user) {
      deleteSession(cookies.session);
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer'],
      });
      if (!checkoutSession) {
        sendJson(res, 404, { error: 'Checkout session not found.' });
        return;
      }
      const sessionEmail =
        checkoutSession.customer_details?.email ||
        (checkoutSession.customer_email ? String(checkoutSession.customer_email) : null);
      if (sessionEmail && sessionEmail.toLowerCase() !== user.email.toLowerCase()) {
        sendJson(res, 403, { error: 'Session does not belong to this account.' });
        return;
      }
      let subscription = checkoutSession.subscription || null;
      let subscriptionId = null;
      if (subscription && typeof subscription === 'string') {
        subscriptionId = subscription;
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
      } else if (subscription && typeof subscription === 'object') {
        subscriptionId = subscription.id;
      }
      if (!subscription) {
        sendJson(res, 409, { error: 'Subscription not available for this session yet.' });
        return;
      }
      const subscriptionStatus = subscription.status || null;
      const validStatuses = new Set(['active', 'trialing']);
      if (checkoutSession.payment_status !== 'paid' || !validStatuses.has(subscriptionStatus)) {
        sendJson(res, 409, { error: 'Subscription is not active.' });
        return;
      }
      const customerId =
        (checkoutSession.customer && typeof checkoutSession.customer === 'object'
          ? checkoutSession.customer.id
          : null) ||
        (typeof checkoutSession.customer === 'string' ? checkoutSession.customer : null);
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;
      if (!periodEnd) {
        console.warn('Stripe subscription missing current_period_end', {
          status: subscriptionStatus,
          subscriptionId,
        });
      }
      const nowIso = new Date().toISOString();
      storage.updateUserPlan(user.id, {
        plan: 'pro',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeSubscriptionStatus: subscriptionStatus,
        stripeSubscriptionPeriodEnd: periodEnd,
        planUpdatedAt: nowIso,
      });
      sendJson(res, 200, {
        plan: 'pro',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeSubscriptionStatus: subscriptionStatus,
        stripeSubscriptionPeriodEnd: periodEnd,
        planUpdatedAt: nowIso,
      });
    } catch (err) {
      console.error('Failed to confirm Stripe checkout session', err);
      sendJson(res, 502, { error: 'Unable to confirm subscription.' });
    }
    return;
  }

  if (route === '/api/register' && method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const email = String(payload.email || '').trim().toLowerCase();
      const password = String(payload.password || '');
      if (!email || !email.includes('@')) {
        sendJson(res, 400, { error: 'A valid email is required.' });
        return;
      }
      if (password.length < 6) {
        sendJson(res, 400, { error: 'Password must be at least 6 characters.' });
        return;
      }
      if (storage.getUserByEmail(email)) {
        sendJson(res, 409, { error: 'Email already registered.' });
        return;
      }
      const now = new Date().toISOString();
      const newUser = {
        id: randomBytes(10).toString('hex'),
        email,
        passwordHash: hashPassword(password),
        createdAt: now,
        plan: 'free',
        planUpdatedAt: now,
      };
      storage.createUser(newUser);
      sendWelcomeEmail(newUser);
      const session = createSession(newUser.id);
      sendJson(
        res,
        201,
        {
          authenticated: true,
          user: {
            id: newUser.id,
            email: newUser.email,
            createdAt: newUser.createdAt,
            plan: newUser.plan,
            planUpdatedAt: newUser.planUpdatedAt,
            stripeSubscriptionStatus: null,
            stripeSubscriptionPeriodEnd: null,
          },
        },
        {
          'Set-Cookie': buildSessionCookie(session.token, SESSION_TTL_SECONDS),
        },
      );
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'Payload too large.' });
        return;
      }
      if (err && err.code === 'INVALID_JSON') {
        sendJson(res, 400, { error: 'Invalid JSON payload.' });
        return;
      }
      if (err && typeof err.code === 'string' && err.code.includes('SQLITE_CONSTRAINT')) {
        sendJson(res, 409, { error: 'Email already registered.' });
        return;
      }
      console.error('Failed to register user', err);
      sendJson(res, 500, { error: 'Failed to register.' });
    }
    return;
  }

  if (route === '/api/login' && method === 'POST') {
    try {
      const payload = await readJsonBody(req);
      const email = String(payload.email || '').trim().toLowerCase();
      const password = String(payload.password || '');
      const user = storage.getUserByEmail(email);
      if (!user) {
        sendJson(res, 401, { error: 'Invalid email or password.' });
        return;
      }
      if (!verifyPassword(password, user.passwordHash)) {
        sendJson(res, 401, { error: 'Invalid email or password.' });
        return;
      }
      const session = createSession(user.id);
      sendJson(
        res,
        200,
        {
          authenticated: true,
          user: {
            id: user.id,
            email: user.email,
            createdAt: user.createdAt,
            plan: user.plan || 'free',
            planUpdatedAt: user.planUpdatedAt || null,
            stripeSubscriptionStatus: user.stripeSubscriptionStatus || null,
            stripeSubscriptionPeriodEnd: user.stripeSubscriptionPeriodEnd || null,
          },
        },
        {
          'Set-Cookie': buildSessionCookie(session.token, SESSION_TTL_SECONDS),
        },
      );
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'Payload too large.' });
        return;
      }
      if (err && err.code === 'INVALID_JSON') {
        sendJson(res, 400, { error: 'Invalid JSON payload.' });
        return;
      }
      console.error('Failed to log in user', err);
      sendJson(res, 500, { error: 'Failed to login.' });
    }
    return;
  }

  if (route === '/api/logout' && method === 'POST') {
    if (cookies.session) {
      deleteSession(cookies.session);
    }
    sendJson(
      res,
      200,
      { success: true },
      { 'Set-Cookie': buildSessionCookie('', 0) },
    );
    return;
  }

  if (route === '/api/sounds/upsert' && method === 'POST') {
    if (!activeSession) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const user = storage.getUserById(activeSession.userId);
    if (!user) {
      deleteSession(cookies.session);
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'Payload too large.' });
        return;
      }
      if (err && err.code === 'INVALID_JSON') {
        sendJson(res, 400, { error: 'Invalid JSON payload.' });
        return;
      }
      sendJson(res, 400, { error: 'Invalid request body.' });
      return;
    }
    const parsed = canonicalPayloadValue(payload.text);
    if (!parsed) {
      sendJson(res, 400, { error: 'A non-empty text payload is required.' });
      return;
    }
    try {
      const link = storage.upsertSoundLink({
        userId: user.id,
        payloadText: parsed.payloadText,
        payloadKeyHash: buildPayloadHash(parsed.normalizedValue),
        targetUrl: parsed.targetUrl,
        nowIso: new Date().toISOString(),
      });
      sendJson(res, 200, { link: mapSoundLinkForClient(link) });
    } catch (err) {
      console.error('Failed to upsert sound link', err);
      sendJson(res, 500, { error: 'Failed to save sound link.' });
    }
    return;
  }

  if (route === '/api/scans/report' && method === 'POST') {
    let payload = {};
    try {
      payload = await readJsonBody(req);
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
        sendJson(res, 413, { error: 'Payload too large.' });
        return;
      }
      if (err && err.code === 'INVALID_JSON') {
        sendJson(res, 400, { error: 'Invalid JSON payload.' });
        return;
      }
      sendJson(res, 400, { error: 'Invalid request body.' });
      return;
    }
    const parsed = canonicalPayloadValue(payload.text);
    if (!parsed) {
      sendJson(res, 400, { error: 'A non-empty text payload is required.' });
      return;
    }
    try {
      const scanResult = storage.reportSoundScan({
        payloadKeyHash: buildPayloadHash(parsed.normalizedValue),
        scannerUserId: activeSession ? activeSession.userId : null,
        scannedAt: new Date().toISOString(),
      });
      if (!scanResult) {
        sendJson(res, 200, { matched: false });
        return;
      }
      const isOwnSound = !!(
        activeSession &&
        activeSession.userId &&
        activeSession.userId === scanResult.ownerUserId
      );
      sendJson(res, 200, {
        matched: true,
        isOwnSound,
      });
    } catch (err) {
      console.error('Failed to report sound scan', err);
      sendJson(res, 500, { error: 'Failed to report scan.' });
    }
    return;
  }

  if (route === '/api/sounds' && method === 'GET') {
    if (!activeSession) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const user = storage.getUserById(activeSession.userId);
    if (!user) {
      deleteSession(cookies.session);
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    try {
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const links = storage
        .listUserSoundLinks(user.id, sinceIso)
        .map((row) => mapSoundLinkForClient(row));
      sendJson(res, 200, { links });
    } catch (err) {
      console.error('Failed to list sound links', err);
      sendJson(res, 500, { error: 'Failed to load sound links.' });
    }
    return;
  }

  if (route === '/api/analytics/summary' && method === 'GET') {
    if (!activeSession) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const user = storage.getUserById(activeSession.userId);
    if (!user) {
      deleteSession(cookies.session);
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const range = parseAnalyticsRange(url.searchParams.get('range'));
    const linkId = parseAnalyticsLinkId(url.searchParams.get('linkId'));
    const bucket = parseAnalyticsBucket(url.searchParams.get('bucket'), range);
    const tz = String(url.searchParams.get('tz') || 'UTC');
    const windowMeta = buildAnalyticsWindowMeta(range, bucket);
    try {
      const summary = storage.getAnalyticsSummary({
        userId: user.id,
        startIso: windowMeta.startIso,
        endIso: windowMeta.endIso,
        previousStartIso: windowMeta.previousStartIso,
        previousEndIso: windowMeta.previousEndIso,
        linkId,
        bucket,
      });
      sendJson(res, 200, {
        range,
        bucket,
        tz,
        linkId: linkId || 'all',
        startIso: windowMeta.startIso,
        endIso: windowMeta.endIso,
        previousStartIso: windowMeta.previousStartIso,
        previousEndIso: windowMeta.previousEndIso,
        ...summary,
      });
    } catch (err) {
      console.error('Failed to build analytics summary', err);
      sendJson(res, 500, { error: 'Failed to load analytics summary.' });
    }
    return;
  }

  if (route === '/api/analytics/timeseries' && method === 'GET') {
    if (!activeSession) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const user = storage.getUserById(activeSession.userId);
    if (!user) {
      deleteSession(cookies.session);
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const range = parseAnalyticsRange(url.searchParams.get('range'));
    const linkId = parseAnalyticsLinkId(url.searchParams.get('linkId'));
    const bucket = parseAnalyticsBucket(url.searchParams.get('bucket'), range);
    const tz = String(url.searchParams.get('tz') || 'UTC');
    const windowMeta = buildAnalyticsWindowMeta(range, bucket);
    try {
      const points = storage.getAnalyticsTimeseries({
        userId: user.id,
        startIso: windowMeta.startIso,
        endIso: windowMeta.endIso,
        linkId,
        bucket,
      });
      sendJson(res, 200, {
        range,
        bucket,
        tz,
        linkId: linkId || 'all',
        startIso: windowMeta.startIso,
        endIso: windowMeta.endIso,
        points,
      });
    } catch (err) {
      console.error('Failed to load analytics timeseries', err);
      sendJson(res, 500, { error: 'Failed to load analytics timeseries.' });
    }
    return;
  }

  if (route === '/api/analytics/top-links' && method === 'GET') {
    if (!activeSession) {
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const user = storage.getUserById(activeSession.userId);
    if (!user) {
      deleteSession(cookies.session);
      sendJson(res, 401, { error: 'Authentication required.' });
      return;
    }
    const range = parseAnalyticsRange(url.searchParams.get('range'));
    const bucket = parseAnalyticsBucket(url.searchParams.get('bucket'), range);
    const limit = parseAnalyticsLimit(url.searchParams.get('limit'));
    const tz = String(url.searchParams.get('tz') || 'UTC');
    const windowMeta = buildAnalyticsWindowMeta(range, bucket);
    try {
      const links = storage.getAnalyticsTopLinks({
        userId: user.id,
        startIso: windowMeta.startIso,
        endIso: windowMeta.endIso,
        limit,
        bucket,
      });
      sendJson(res, 200, {
        range,
        bucket,
        tz,
        limit,
        startIso: windowMeta.startIso,
        endIso: windowMeta.endIso,
        links,
      });
    } catch (err) {
      console.error('Failed to load top links analytics', err);
      sendJson(res, 500, { error: 'Failed to load top links analytics.' });
    }
    return;
  }

  console.warn(`Unhandled API route ${method} ${route}`);
  sendJson(res, 404, { error: 'Not Found' });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveStatic(req, res) {
  let pathname;
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const trimmed = pathname.replace(/\/+$/, '');
  const relativePath = trimmed === '' || trimmed === '/' ? 'index.html' : trimmed.slice(1);

  if (trimmed === '/admin.html') {
    res.writeHead(302, {
      Location: '/new/admin.html',
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }
  const candidates = [];

  if (relativePath) {
    candidates.push(relativePath);
    if (!path.extname(relativePath)) {
      candidates.push(path.join(relativePath, 'index.html'));
    }
  } else {
    candidates.push('index.html');
  }

  for (const candidate of candidates) {
    const joined = path.join(PUBLIC_DIR, candidate);
    const resolved = path.resolve(joined);
    if (resolved !== PUBLIC_DIR && !resolved.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
      continue;
    }
    try {
      const stat = await fsp.stat(resolved);
      if (stat.isDirectory()) {
        continue;
      }
      const data = await fsp.readFile(resolved);
      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
      return;
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        continue;
      }
      console.error('Failed to serve asset', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

async function requestHandler(req, res) {
  setSecurityHeaders(res);
  if (req.url.startsWith('/api/')) {
    await handleApiRequest(req, res);
    return;
  }
  await serveStatic(req, res);
}

async function start() {
  await initialiseStorage();
  const server = http.createServer((req, res) => {
    requestHandler(req, res).catch((err) => {
      console.error('Unhandled error', err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    });
  });
  server.listen(PORT, HOST, () => {
    const address = server.address();
    const host = typeof address === 'object' && address ? address.address : HOST;
    const port = typeof address === 'object' && address ? address.port : PORT;
    console.log(`AudioLink server running at http://${host}:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
