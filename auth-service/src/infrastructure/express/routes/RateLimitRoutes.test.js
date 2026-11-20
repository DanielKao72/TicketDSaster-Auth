const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const App = require('../App');

const STAFF = { username: 'test-staff', password: 'test-staff-password' };
const RATE_LIMIT = { windowMs: 60_000, maxFailedAttempts: 3 };

function basicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

// Brute-force protection: failed attempts on the credential endpoints are
// limited per client IP; successful ones never count.
describe('Rate limit de intentos fallidos', () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    server = http.createServer(new App({ staffCredentials: STAFF, rateLimit: RATE_LIMIT }).build());
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${server.address().port}`;
  });

  afterEach(() => new Promise((resolve) => server.close(resolve)));

  function post(path, body, headers = {}) {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  async function registerPartner(username, password) {
    const invitation = await post('/invitations', { role: 'ORGANIZER' }, {
      Authorization: basicAuth(STAFF.username, STAFF.password),
    });
    const { code } = await invitation.json();
    const res = await post('/auth/register', { username, password, invitationCode: code });
    assert.equal(res.status, 201);
  }

  test('POST /auth/login responde 429 al superar los intentos fallidos', async () => {
    await registerPartner('venue1', 'Password123');

    for (let attempt = 1; attempt <= RATE_LIMIT.maxFailedAttempts; attempt += 1) {
      const res = await post('/auth/login', { username: 'venue1', password: `Wrong${attempt}` });
      assert.equal(res.status, 401);
    }

    const blocked = await post('/auth/login', { username: 'venue1', password: 'Password123' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '60');
    assert.deepEqual(await blocked.json(), { error: 'Too many failed attempts, try again later' });
  });

  test('los logins exitosos no cuentan para el límite', async () => {
    await registerPartner('venue1', 'Password123');

    for (let attempt = 1; attempt <= RATE_LIMIT.maxFailedAttempts + 2; attempt += 1) {
      const res = await post('/auth/login', { username: 'venue1', password: 'Password123' });
      assert.equal(res.status, 200);
    }
  });

  test('POST /invitations responde 429 tras varias credenciales de staff incorrectas', async () => {
    for (let attempt = 1; attempt <= RATE_LIMIT.maxFailedAttempts; attempt += 1) {
      const res = await post('/invitations', { role: 'ORGANIZER' }, {
        Authorization: basicAuth(STAFF.username, `wrong-${attempt}`),
      });
      assert.equal(res.status, 401);
    }

    // Even the right credential is rejected until the window resets.
    const blocked = await post('/invitations', { role: 'ORGANIZER' }, {
      Authorization: basicAuth(STAFF.username, STAFF.password),
    });
    assert.equal(blocked.status, 429);
  });

  test('login e invitaciones llevan contadores separados', async () => {
    for (let attempt = 1; attempt <= RATE_LIMIT.maxFailedAttempts; attempt += 1) {
      await post('/auth/login', { username: 'nadie', password: 'Wrong1234' });
    }

    const res = await post('/invitations', { role: 'ORGANIZER' }, {
      Authorization: basicAuth(STAFF.username, STAFF.password),
    });
    assert.equal(res.status, 201);
  });
});
