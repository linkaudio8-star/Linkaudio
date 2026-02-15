#!/usr/bin/env node

const { spawn } = require('child_process');
const { once } = require('events');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_COMMAND = ['node', 'server.js'];
const BASE_URL = 'http://127.0.0.1:3000';

async function waitForServer(timeoutMs = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/session`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.ok || response.status === 404) {
        return;
      }
    } catch (err) {
      // swallow connection errors until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Server did not become ready in time');
}

function extractSessionCookie(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    const cookies = response.headers.getSetCookie();
    if (Array.isArray(cookies) && cookies.length > 0) {
      return cookies[0].split(';')[0];
    }
  }
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : null;
}

async function registerUser(email, password) {
  const response = await fetch(`${BASE_URL}/api/register`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (response.status !== 201) {
    const text = await response.text();
    throw new Error(`Register failed (${response.status}): ${text}`);
  }
  const payload = await response.json();
  if (!payload?.authenticated || payload?.user?.email !== email) {
    throw new Error('Register response missing expected payload');
  }
  const sessionCookie = extractSessionCookie(response);
  if (!sessionCookie) {
    throw new Error('Register response missing session cookie');
  }
  return { payload, sessionCookie };
}

async function logout(sessionCookie) {
  const response = await fetch(`${BASE_URL}/api/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Cookie: sessionCookie,
    },
  });
  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Logout failed (${response.status}): ${text}`);
  }
}

async function loginUser(email, password) {
  const response = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Login failed (${response.status}): ${text}`);
  }
  const payload = await response.json();
  if (!payload?.authenticated || payload?.user?.email !== email) {
    throw new Error('Login response missing expected payload');
  }
  const sessionCookie = extractSessionCookie(response);
  if (!sessionCookie) {
    throw new Error('Login response missing session cookie');
  }
  return { payload, sessionCookie };
}

async function run() {
  const server = spawn(SERVER_COMMAND[0], SERVER_COMMAND.slice(1), {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = [];
  const stderr = [];

  server.stdout.on('data', (chunk) => stdout.push(chunk.toString()));
  server.stderr.on('data', (chunk) => stderr.push(chunk.toString()));

  try {
    await waitForServer();
    const uniqueEmail = `smoke-${Date.now()}@example.com`;
    const password = 'Secret123!';

    const { sessionCookie: registerCookie } = await registerUser(uniqueEmail, password);
    await logout(registerCookie);
    await loginUser(uniqueEmail, password);

    console.log('login-smoke: PASS');
  } finally {
    server.kill();
    await once(server, 'close');
    if (stdout.length) {
      process.stderr.write(stdout.join(''));
    }
    if (stderr.length) {
      process.stderr.write(stderr.join(''));
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
