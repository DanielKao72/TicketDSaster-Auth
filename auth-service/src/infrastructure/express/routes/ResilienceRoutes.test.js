const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const App = require('../App');
const { staff } = require('../../config/Env');
const ResiliencePolicy = require('../../resilience/ResiliencePolicy');
const InMemoryInvitationRepository = require('../../../adapters/repositories/InMemoryInvitationRepository');
const InMemoryInvitationExpirationStore = require('../../../adapters/repositories/InMemoryInvitationExpirationStore');
const ResilientInvitationExpirationStore = require('../../../adapters/resilience/ResilientInvitationExpirationStore');

// Redis accepts the invitation window when the code is generated and then goes
// down before the partner registers.
class RedisGoesDownStore extends InMemoryInvitationExpirationStore {
  async isActive() {
    throw new Error('ECONNREFUSED');
  }
}

describe('Resiliencia: Redis caido durante el registro', () => {
  let server;
  let baseUrl;
  let invitationRepository;

  const staffAuthorization = `Basic ${Buffer.from(`${staff.username}:${staff.password}`).toString('base64')}`;

  async function post(path, body, headers = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }

  before(async () => {
    const redisPolicy = new ResiliencePolicy({
      name: 'redis',
      timeoutMs: 50,
      retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2 },
      breaker: { consecutiveFailures: 1, halfOpenAfterMs: 30000 },
      logger: { warn: () => {} },
    });
    invitationRepository = new InMemoryInvitationRepository();

    const app = new App({
      invitationRepository,
      invitationExpirationStore: new ResilientInvitationExpirationStore({
        inner: new RedisGoesDownStore(),
        policy: redisPolicy,
      }),
      resilience: { redis: redisPolicy },
    }).build();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /health informa el circuito cerrado mientras Redis responde', async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', dependencies: { redis: 'closed' } });
  });

  test('POST /auth/register responde 503 con Retry-After y no consume el codigo', async () => {
    const invitation = await post('/invitations', { role: 'ORGANIZER' }, { Authorization: staffAuthorization });
    assert.equal(invitation.status, 201);

    const { status, headers, body } = await post('/auth/register', {
      username: 'organizer-sin-redis',
      password: 'password123',
      invitationCode: invitation.body.code,
    });

    assert.equal(status, 503);
    assert.equal(headers.get('retry-after'), '30');
    assert.deepEqual(body, { error: 'Service temporarily unavailable' });
    assert.equal((await invitationRepository.findByCode(invitation.body.code)).used, false);
  });

  test('GET /health sigue en 200 pero informa el circuito de Redis abierto', async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'degraded', dependencies: { redis: 'open' } });
  });

  test('POST /auth/validate no depende de los stores y sigue respondiendo', async () => {
    const { status } = await post('/auth/validate', { token: 'no-es-un-jwt' });

    assert.notEqual(status, 503);
  });
});
