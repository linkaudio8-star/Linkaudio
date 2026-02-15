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
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
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
};
