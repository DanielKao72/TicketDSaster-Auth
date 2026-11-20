const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');

const config = require('../../infrastructure/config/Env');
const RedisConnection = require('../../infrastructure/cache/RedisConnection');
const RedisInvitationExpirationStore = require('./RedisInvitationExpirationStore');

// Integration: needs a real Redis (docker compose up redis) and
// RUN_INTEGRATION_TESTS=true. Skipped otherwise, e.g. in CI.
describe('RedisInvitationExpirationStore', { skip: !config.integrationTests }, () => {
  let connection;
  let store;
  const code = `TEST-${Date.now()}`;

  before(async () => {
    connection = new RedisConnection(config.redis);
    await connection.connect();
    store = new RedisInvitationExpirationStore({ redisClient: connection.client });
  });

  after(async () => {
    await store.revoke(code);
    await connection.close();
  });

  test('PA-03: el codigo esta activo y Redis lo borra al pasar su TTL', async () => {
    await store.markActive(code, 1);
    assert.equal(await store.isActive(code), true);

    await sleep(1500);

    assert.equal(await store.isActive(code), false);
  });

  test('revoke desactiva el codigo antes de su TTL', async () => {
    await store.markActive(code, 300);

    await store.revoke(code);

    assert.equal(await store.isActive(code), false);
  });
});
