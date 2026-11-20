const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ResilientInvitationExpirationStore = require('./ResilientInvitationExpirationStore');
const InMemoryInvitationExpirationStore = require('../repositories/InMemoryInvitationExpirationStore');
const ResiliencePolicy = require('../../infrastructure/resilience/ResiliencePolicy');
const ServiceUnavailableError = require('../../core/use-cases/errors/ServiceUnavailableError');

const silentLogger = { warn: () => {} };

function createPolicy() {
  return new ResiliencePolicy({
    name: 'redis',
    timeoutMs: 50,
    retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 2 },
    breaker: { consecutiveFailures: 5, halfOpenAfterMs: 10000 },
    logger: silentLogger,
  });
}

// Every command fails, like Redis while it is down.
class DownExpirationStore extends InMemoryInvitationExpirationStore {
  async markActive() {
    throw new Error('ECONNREFUSED');
  }

  async isActive() {
    throw new Error('ECONNREFUSED');
  }

  async revoke() {
    throw new Error('ECONNREFUSED');
  }
}

describe('ResilientInvitationExpirationStore', () => {
  test('delega en el store cuando Redis responde', async () => {
    const store = new ResilientInvitationExpirationStore({
      inner: new InMemoryInvitationExpirationStore(),
      policy: createPolicy(),
    });

    await store.markActive('ABC', 60);
    assert.equal(await store.isActive('ABC'), true);
    await store.revoke('ABC');
    assert.equal(await store.isActive('ABC'), false);
  });

  test('isActive falla cerrado con ServiceUnavailableError si Redis esta caido', async () => {
    const store = new ResilientInvitationExpirationStore({ inner: new DownExpirationStore(), policy: createPolicy() });

    await assert.rejects(() => store.isActive('ABC'), ServiceUnavailableError);
  });

  test('markActive falla cerrado con ServiceUnavailableError si Redis esta caido', async () => {
    const store = new ResilientInvitationExpirationStore({ inner: new DownExpirationStore(), policy: createPolicy() });

    await assert.rejects(() => store.markActive('ABC', 60), ServiceUnavailableError);
  });

  test('revoke es best effort: si Redis esta caido devuelve undefined y avisa', async () => {
    const warnings = [];
    const store = new ResilientInvitationExpirationStore({
      inner: new DownExpirationStore(),
      policy: createPolicy(),
      logger: { warn: (message) => warnings.push(message) },
    });

    assert.equal(await store.revoke('ABC'), undefined);
    assert.equal(warnings.length, 1);
  });
});
