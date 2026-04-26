const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const Database = require('better-sqlite3');

let db = null;
let databasePath = null;

function assertInitialised() {
  if (!db) {
    throw new Error('Storage has not been initialised.');
  }
}

function openDatabase(filePath) {
  const instance = new Database(filePath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  instance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sound_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payload_text TEXT NOT NULL,
      payload_key_hash TEXT NOT NULL,
      target_url TEXT,
      scan_count INTEGER NOT NULL DEFAULT 0,
      last_scan_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, payload_key_hash)
    );
    CREATE TABLE IF NOT EXISTS sound_link_scans (
      id TEXT PRIMARY KEY,
      sound_link_id TEXT NOT NULL,
      scanner_user_id TEXT,
      scanned_at TEXT NOT NULL,
      FOREIGN KEY (sound_link_id) REFERENCES sound_links(id) ON DELETE CASCADE,
      FOREIGN KEY (scanner_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
    CREATE INDEX IF NOT EXISTS idx_sound_links_user_updated ON sound_links (user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sound_links_payload_hash ON sound_links (payload_key_hash);
    CREATE INDEX IF NOT EXISTS idx_sound_link_scans_link_time ON sound_link_scans (sound_link_id, scanned_at DESC);
    CREATE TABLE IF NOT EXISTS sound_link_scan_rollups_hourly (
      user_id TEXT NOT NULL,
      sound_link_id TEXT NOT NULL,
      bucket_start TEXT NOT NULL,
      scan_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, sound_link_id, bucket_start),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (sound_link_id) REFERENCES sound_links(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sound_link_scan_rollups_daily (
      user_id TEXT NOT NULL,
      sound_link_id TEXT NOT NULL,
      bucket_start TEXT NOT NULL,
      scan_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, sound_link_id, bucket_start),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (sound_link_id) REFERENCES sound_links(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sound_link_scan_rollups_hourly_window
      ON sound_link_scan_rollups_hourly (user_id, bucket_start);
    CREATE INDEX IF NOT EXISTS idx_sound_link_scan_rollups_daily_window
      ON sound_link_scan_rollups_daily (user_id, bucket_start);
  `);

  const ensureColumn = (statement) => {
    try {
      instance.exec(statement);
    } catch (err) {
      if (!err || typeof err.message !== 'string' || !err.message.includes('duplicate column name')) {
        throw err;
      }
    }
  };

  ensureColumn("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
  ensureColumn("ALTER TABLE users ADD COLUMN plan_updated_at TEXT");
  ensureColumn("ALTER TABLE users ADD COLUMN stripe_customer_id TEXT");
  ensureColumn("ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT");
  ensureColumn("ALTER TABLE users ADD COLUMN stripe_subscription_status TEXT");
  ensureColumn("ALTER TABLE users ADD COLUMN stripe_subscription_period_end TEXT");

  return instance;
}

async function initStorage(dataDir) {
  if (db) {
    return;
  }
  await fsp.mkdir(dataDir, { recursive: true });
  databasePath = path.join(dataDir, 'audiolink.db');
  db = openDatabase(databasePath);
}

function migrateLegacyUsers(legacyPath) {
  assertInitialised();
  if (!legacyPath) return;
  let raw;
  try {
    raw = fs.readFileSync(legacyPath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return;
    }
    throw err;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('Legacy users file is invalid JSON, skipping migration.');
    return;
  }
  if (!Array.isArray(parsed)) return;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO users (
      id,
      email,
      password_hash,
      created_at,
      plan,
      plan_updated_at
    ) VALUES (@id, @email, @passwordHash, @createdAt, 'free', @createdAt)`,
  );
  const migrate = db.transaction((users) => {
    for (const user of users) {
      if (!user || typeof user.email !== 'string' || typeof user.passwordHash !== 'string') {
        continue;
      }
      insert.run({
        id: user.id || Buffer.from(user.email).toString('hex').slice(0, 20),
        email: user.email.toLowerCase(),
        passwordHash: user.passwordHash,
        createdAt: user.createdAt || new Date().toISOString(),
      });
    }
  });
  migrate(parsed);
}

function createUser({ id, email, passwordHash, createdAt, plan = 'free', planUpdatedAt = createdAt }) {
  assertInitialised();
  const stmt = db.prepare(
    `INSERT INTO users (
      id,
      email,
      password_hash,
      created_at,
      plan,
      plan_updated_at
    ) VALUES (@id, @email, @passwordHash, @createdAt, @plan, @planUpdatedAt)`,
  );
  stmt.run({ id, email, passwordHash, createdAt, plan, planUpdatedAt });
}

function getUserByEmail(email) {
  assertInitialised();
  const stmt = db.prepare(
    `SELECT
      id,
      email,
      password_hash AS passwordHash,
      created_at AS createdAt,
      plan,
      plan_updated_at AS planUpdatedAt,
      stripe_customer_id AS stripeCustomerId,
      stripe_subscription_id AS stripeSubscriptionId,
      stripe_subscription_status AS stripeSubscriptionStatus,
      stripe_subscription_period_end AS stripeSubscriptionPeriodEnd
    FROM users
    WHERE email = ?`,
  );
  return stmt.get(email);
}

function getUserById(id) {
  assertInitialised();
  const stmt = db.prepare(
    `SELECT
      id,
      email,
      password_hash AS passwordHash,
      created_at AS createdAt,
      plan,
      plan_updated_at AS planUpdatedAt,
      stripe_customer_id AS stripeCustomerId,
      stripe_subscription_id AS stripeSubscriptionId,
      stripe_subscription_status AS stripeSubscriptionStatus,
      stripe_subscription_period_end AS stripeSubscriptionPeriodEnd
    FROM users
    WHERE id = ?`,
  );
  return stmt.get(id);
}

function createSession({ token, userId, expiresAt }) {
  assertInitialised();
  const stmt = db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (@token, @userId, @expiresAt)',
  );
  stmt.run({ token, userId, expiresAt });
}

function getSession(token) {
  assertInitialised();
  const stmt = db.prepare(
    'SELECT token, user_id AS userId, expires_at AS expiresAt FROM sessions WHERE token = ?',
  );
  return stmt.get(token);
}

function deleteSession(token) {
  assertInitialised();
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
}

function purgeExpiredSessions(now) {
  assertInitialised();
  const stmt = db.prepare('DELETE FROM sessions WHERE expires_at < ?');
  stmt.run(now);
}

function updateUserPlan(userId, { plan, stripeCustomerId, stripeSubscriptionId, stripeSubscriptionStatus, stripeSubscriptionPeriodEnd, planUpdatedAt }) {
  assertInitialised();
  const stmt = db.prepare(
    `UPDATE users
     SET
       plan = COALESCE(@plan, plan),
       stripe_customer_id = COALESCE(@stripeCustomerId, stripe_customer_id),
       stripe_subscription_id = COALESCE(@stripeSubscriptionId, stripe_subscription_id),
       stripe_subscription_status = COALESCE(@stripeSubscriptionStatus, stripe_subscription_status),
       stripe_subscription_period_end = COALESCE(@stripeSubscriptionPeriodEnd, stripe_subscription_period_end),
       plan_updated_at = COALESCE(@planUpdatedAt, plan_updated_at)
     WHERE id = @userId`,
  );
  stmt.run({
    userId,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSubscriptionStatus,
    stripeSubscriptionPeriodEnd,
    planUpdatedAt,
  });
}

function getUserBilling(userId) {
  assertInitialised();
  const stmt = db.prepare(
    `SELECT
       plan,
       plan_updated_at AS planUpdatedAt,
       stripe_customer_id AS stripeCustomerId,
       stripe_subscription_id AS stripeSubscriptionId,
       stripe_subscription_status AS stripeSubscriptionStatus,
       stripe_subscription_period_end AS stripeSubscriptionPeriodEnd
     FROM users
     WHERE id = ?`,
  );
  return stmt.get(userId);
}

function upsertSoundLink({ userId, payloadText, payloadKeyHash, targetUrl, nowIso }) {
  assertInitialised();
  const updateStmt = db.prepare(
    `UPDATE sound_links
     SET payload_text = @payloadText,
         target_url = @targetUrl,
         updated_at = @nowIso
     WHERE user_id = @userId AND payload_key_hash = @payloadKeyHash`,
  );
  const insertStmt = db.prepare(
    `INSERT INTO sound_links (
      id,
      user_id,
      payload_text,
      payload_key_hash,
      target_url,
      created_at,
      updated_at
    )
    VALUES (
      lower(hex(randomblob(16))),
      @userId,
      @payloadText,
      @payloadKeyHash,
      @targetUrl,
      @nowIso,
      @nowIso
    )`,
  );
  const selectStmt = db.prepare(
    `SELECT
      id,
      user_id AS userId,
      payload_text AS payloadText,
      payload_key_hash AS payloadKeyHash,
      target_url AS targetUrl,
      scan_count AS scanCount,
      last_scan_at AS lastScanAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM sound_links
    WHERE user_id = @userId AND payload_key_hash = @payloadKeyHash`,
  );
  const tx = db.transaction((params) => {
    const updated = updateStmt.run(params);
    if (updated.changes === 0) {
      insertStmt.run(params);
    }
    return selectStmt.get(params);
  });
  return tx({ userId, payloadText, payloadKeyHash, targetUrl: targetUrl || null, nowIso });
}

function reportSoundScan({ payloadKeyHash, scannerUserId, scannedAt }) {
  assertInitialised();
  const findStmt = db.prepare(
    `SELECT
      id,
      user_id AS userId
    FROM sound_links
    WHERE payload_key_hash = ?
    ORDER BY updated_at DESC
    LIMIT 1`,
  );
  const insertScanStmt = db.prepare(
    `INSERT INTO sound_link_scans (
      id,
      sound_link_id,
      scanner_user_id,
      scanned_at
    ) VALUES (
      lower(hex(randomblob(16))),
      @soundLinkId,
      @scannerUserId,
      @scannedAt
    )`,
  );
  const updateLinkStmt = db.prepare(
    `UPDATE sound_links
     SET scan_count = scan_count + 1,
         last_scan_at = @scannedAt
     WHERE id = @soundLinkId`,
  );
  const upsertHourlyRollupStmt = db.prepare(
    `INSERT INTO sound_link_scan_rollups_hourly (
      user_id,
      sound_link_id,
      bucket_start,
      scan_count
    ) VALUES (
      @userId,
      @soundLinkId,
      @bucketStart,
      1
    )
    ON CONFLICT(user_id, sound_link_id, bucket_start)
    DO UPDATE SET scan_count = scan_count + excluded.scan_count`,
  );
  const upsertDailyRollupStmt = db.prepare(
    `INSERT INTO sound_link_scan_rollups_daily (
      user_id,
      sound_link_id,
      bucket_start,
      scan_count
    ) VALUES (
      @userId,
      @soundLinkId,
      @bucketStart,
      1
    )
    ON CONFLICT(user_id, sound_link_id, bucket_start)
    DO UPDATE SET scan_count = scan_count + excluded.scan_count`,
  );

  const tx = db.transaction((params) => {
    const link = findStmt.get(params.payloadKeyHash);
    if (!link) {
      return null;
    }
    insertScanStmt.run({
      soundLinkId: link.id,
      scannerUserId: params.scannerUserId || null,
      scannedAt: params.scannedAt,
    });
    updateLinkStmt.run({
      soundLinkId: link.id,
      scannedAt: params.scannedAt,
    });
    const scanDate = new Date(params.scannedAt);
    const hourBucket = new Date(Date.UTC(
      scanDate.getUTCFullYear(),
      scanDate.getUTCMonth(),
      scanDate.getUTCDate(),
      scanDate.getUTCHours(),
      0,
      0,
      0,
    )).toISOString();
    const dayBucket = new Date(Date.UTC(
      scanDate.getUTCFullYear(),
      scanDate.getUTCMonth(),
      scanDate.getUTCDate(),
      0,
      0,
      0,
      0,
    )).toISOString();
    upsertHourlyRollupStmt.run({
      userId: link.userId,
      soundLinkId: link.id,
      bucketStart: hourBucket,
    });
    upsertDailyRollupStmt.run({
      userId: link.userId,
      soundLinkId: link.id,
      bucketStart: dayBucket,
    });
    return {
      soundLinkId: link.id,
      ownerUserId: link.userId,
    };
  });

  return tx({ payloadKeyHash, scannerUserId: scannerUserId || null, scannedAt });
}

function getAnalyticsRollupTable(bucket = 'hour') {
  return bucket === 'day' ? 'sound_link_scan_rollups_daily' : 'sound_link_scan_rollups_hourly';
}

function addBucketInterval(date, bucket = 'hour') {
  const next = new Date(date.getTime());
  if (bucket === 'day') {
    next.setUTCDate(next.getUTCDate() + 1);
  } else {
    next.setUTCHours(next.getUTCHours() + 1);
  }
  return next;
}

function ensureAnalyticsRollupsForUser(userId) {
  assertInitialised();
  const scansCountRow = db.prepare(
    `SELECT COUNT(*) AS total
    FROM sound_link_scans sls
    INNER JOIN sound_links sl ON sl.id = sls.sound_link_id
    WHERE sl.user_id = ?`,
  ).get(userId);
  if (!Number(scansCountRow?.total)) {
    return;
  }
  const rollupsCountRow = db.prepare(
    `SELECT
      (SELECT COUNT(*) FROM sound_link_scan_rollups_hourly WHERE user_id = ?) AS hourlyTotal,
      (SELECT COUNT(*) FROM sound_link_scan_rollups_daily WHERE user_id = ?) AS dailyTotal`,
  ).get(userId, userId);
  const hasRollups = Number(rollupsCountRow?.hourlyTotal) > 0 && Number(rollupsCountRow?.dailyTotal) > 0;
  if (!hasRollups) {
    rebuildAnalyticsRollupsForUser(userId);
  }
}

function rebuildAnalyticsRollupsForUser(userId) {
  assertInitialised();
  const tx = db.transaction((targetUserId) => {
    db.prepare('DELETE FROM sound_link_scan_rollups_hourly WHERE user_id = ?').run(targetUserId);
    db.prepare('DELETE FROM sound_link_scan_rollups_daily WHERE user_id = ?').run(targetUserId);
    db.prepare(
      `INSERT INTO sound_link_scan_rollups_hourly (user_id, sound_link_id, bucket_start, scan_count)
      SELECT
        sl.user_id AS user_id,
        sls.sound_link_id AS sound_link_id,
        strftime('%Y-%m-%dT%H:00:00.000Z', sls.scanned_at) AS bucket_start,
        COUNT(*) AS scan_count
      FROM sound_link_scans sls
      INNER JOIN sound_links sl ON sl.id = sls.sound_link_id
      WHERE sl.user_id = ?
      GROUP BY sl.user_id, sls.sound_link_id, strftime('%Y-%m-%dT%H:00:00.000Z', sls.scanned_at)`,
    ).run(targetUserId);
    db.prepare(
      `INSERT INTO sound_link_scan_rollups_daily (user_id, sound_link_id, bucket_start, scan_count)
      SELECT
        sl.user_id AS user_id,
        sls.sound_link_id AS sound_link_id,
        strftime('%Y-%m-%dT00:00:00.000Z', sls.scanned_at) AS bucket_start,
        COUNT(*) AS scan_count
      FROM sound_link_scans sls
      INNER JOIN sound_links sl ON sl.id = sls.sound_link_id
      WHERE sl.user_id = ?
      GROUP BY sl.user_id, sls.sound_link_id, strftime('%Y-%m-%dT00:00:00.000Z', sls.scanned_at)`,
    ).run(targetUserId);
  });
  tx(userId);
}

function getAnalyticsSummary({
  userId,
  startIso,
  endIso,
  previousStartIso,
  previousEndIso,
  linkId = null,
  bucket = 'hour',
}) {
  assertInitialised();
  ensureAnalyticsRollupsForUser(userId);
  const table = getAnalyticsRollupTable(bucket);
  const linkClause = linkId ? ' AND sound_link_id = @linkId' : '';
  const queryParams = { userId, startIso, endIso, previousStartIso, previousEndIso, linkId };

  const currentWindow = db.prepare(
    `SELECT
      COALESCE(SUM(scan_count), 0) AS scansInRange,
      COUNT(DISTINCT sound_link_id) AS activeLinksInRange
    FROM ${table}
    WHERE user_id = @userId
      AND bucket_start >= @startIso
      AND bucket_start < @endIso${linkClause}`,
  ).get(queryParams);

  const previousWindow = db.prepare(
    `SELECT
      COALESCE(SUM(scan_count), 0) AS scansInRange,
      COUNT(DISTINCT sound_link_id) AS activeLinksInRange
    FROM ${table}
    WHERE user_id = @userId
      AND bucket_start >= @previousStartIso
      AND bucket_start < @previousEndIso${linkClause}`,
  ).get(queryParams);

  const totalStats = db.prepare(
    `SELECT
      COALESCE(SUM(scan_count), 0) AS totalScans,
      MAX(last_scan_at) AS lastScanAt
    FROM sound_links
    WHERE user_id = @userId${linkId ? ' AND id = @linkId' : ''}`,
  ).get({ userId, linkId });

  const previousLastScanRow = db.prepare(
    `SELECT MAX(sls.scanned_at) AS lastScanAt
    FROM sound_link_scans sls
    INNER JOIN sound_links sl ON sl.id = sls.sound_link_id
    WHERE sl.user_id = @userId
      AND sls.scanned_at >= @previousStartIso
      AND sls.scanned_at < @previousEndIso${linkId ? ' AND sl.id = @linkId' : ''}`,
  ).get(queryParams);

  return {
    totalScans: Number(totalStats?.totalScans) || 0,
    scansInRange: Number(currentWindow?.scansInRange) || 0,
    previousScansInRange: Number(previousWindow?.scansInRange) || 0,
    activeLinksInRange: Number(currentWindow?.activeLinksInRange) || 0,
    previousActiveLinksInRange: Number(previousWindow?.activeLinksInRange) || 0,
    lastScanAt: totalStats?.lastScanAt || null,
    previousLastScanAt: previousLastScanRow?.lastScanAt || null,
  };
}

function getAnalyticsTimeseries({ userId, startIso, endIso, linkId = null, bucket = 'hour' }) {
  assertInitialised();
  ensureAnalyticsRollupsForUser(userId);
  const table = getAnalyticsRollupTable(bucket);
  const rows = db.prepare(
    `SELECT
      bucket_start AS bucketStart,
      COALESCE(SUM(scan_count), 0) AS scans
    FROM ${table}
    WHERE user_id = @userId
      AND bucket_start >= @startIso
      AND bucket_start < @endIso
      ${linkId ? 'AND sound_link_id = @linkId' : ''}
    GROUP BY bucket_start
    ORDER BY bucket_start ASC`,
  ).all({ userId, startIso, endIso, linkId });
  const scansByBucket = new Map(rows.map((row) => [row.bucketStart, Number(row.scans) || 0]));
  const points = [];
  let cursor = new Date(startIso);
  const end = new Date(endIso);
  while (cursor < end) {
    const bucketStart = cursor.toISOString();
    points.push({
      bucketStart,
      scans: scansByBucket.get(bucketStart) || 0,
    });
    cursor = addBucketInterval(cursor, bucket);
  }
  return points;
}

function getAnalyticsTopLinks({ userId, startIso, endIso, limit = 10, bucket = 'hour' }) {
  assertInitialised();
  ensureAnalyticsRollupsForUser(userId);
  const table = getAnalyticsRollupTable(bucket);
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.min(50, Math.max(1, Number(limit)))
    : 10;
  return db.prepare(
    `SELECT
      sl.id AS id,
      sl.payload_text AS payloadText,
      sl.target_url AS targetUrl,
      sl.last_scan_at AS lastScanAt,
      COALESCE(SUM(r.scan_count), 0) AS scansInRange,
      COALESCE(sl.scan_count, 0) AS totalScans
    FROM sound_links sl
    LEFT JOIN ${table} r
      ON r.user_id = sl.user_id
      AND r.sound_link_id = sl.id
      AND r.bucket_start >= @startIso
      AND r.bucket_start < @endIso
    WHERE sl.user_id = @userId
    GROUP BY sl.id
    HAVING COALESCE(SUM(r.scan_count), 0) > 0
    ORDER BY scansInRange DESC, sl.last_scan_at DESC
    LIMIT @limit`,
  ).all({
    userId,
    startIso,
    endIso,
    limit: safeLimit,
  }).map((row) => ({
    ...row,
    scansInRange: Number(row.scansInRange) || 0,
    totalScans: Number(row.totalScans) || 0,
    openRate: null,
  }));
}

function listUserSoundLinks(userId, sinceIso) {
  assertInitialised();
  const linksStmt = db.prepare(
    `SELECT
      id,
      user_id AS userId,
      payload_text AS payloadText,
      payload_key_hash AS payloadKeyHash,
      target_url AS targetUrl,
      scan_count AS scanCount,
      last_scan_at AS lastScanAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM sound_links
    WHERE user_id = ?
    ORDER BY updated_at DESC`,
  );
  const recentScanStmt = db.prepare(
    `SELECT scanned_at AS scannedAt
    FROM sound_link_scans
    WHERE sound_link_id = ? AND scanned_at >= ?
    ORDER BY scanned_at ASC`,
  );
  const links = linksStmt.all(userId);
  return links.map((link) => ({
    ...link,
    scanEvents24h: recentScanStmt.all(link.id, sinceIso).map((row) => row.scannedAt),
  }));
}

module.exports = {
  initStorage,
  migrateLegacyUsers,
  createUser,
  getUserByEmail,
  getUserById,
  createSession,
  getSession,
  deleteSession,
  purgeExpiredSessions,
  updateUserPlan,
  getUserBilling,
  upsertSoundLink,
  reportSoundScan,
  listUserSoundLinks,
  rebuildAnalyticsRollupsForUser,
  getAnalyticsSummary,
  getAnalyticsTimeseries,
  getAnalyticsTopLinks,
};
