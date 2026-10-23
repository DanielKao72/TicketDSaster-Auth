const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ResilientUserRepository = require('./ResilientUserRepository');
const InMemoryUserRepository = require('../repositories/InMemoryUserRepository');
const ResiliencePolicy = require('../../infrastructure/resilience/ResiliencePolicy');
const ServiceUnavailableError = require('../../core/use-cases/errors/ServiceUnavailableError');
const UserAlreadyExistsError = require('../../core/use-cases/errors/UserAlreadyExistsError');

function createPolicy() {
  return new ResiliencePolicy({
    name: 'postgres',
    timeoutMs: 50,
    retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 2 },
    breaker: { consecutiveFailures: 5, halfOpenAfterMs: 10000 },
    logger: { warn: () => {} },
  });
}

// Fails the first call of each method, like a dropped connection.
class FlakyUserRepository extends InMemoryUserRepository {
  constructor() {
    super();
    this.calls = { create: 0, findByUsername: 0 };
  }

  async create(data) {
    this.calls.create += 1;
    if (this.calls.create === 1) {
      throw new Error('Connection terminated unexpectedly');
    }
    return super.create(data);
  }

  async findByUsername(username) {
    this.calls.findByUsername += 1;
    if (this.calls.findByUsername === 1) {
      throw new Error('Connection terminated unexpectedly');
    }
    return super.findByUsername(username);
  }
}

describe('ResilientUserRepository', () => {
  test('reintenta una lectura que falla de forma transitoria', async () => {
    const inner = new FlakyUserRepository();
    const repository = new ResilientUserRepository({ inner, policy: createPolicy() });

    assert.equal(await repository.findByUsername('ana'), null);
    assert.equal(inner.calls.findByUsername, 2);
  });

  test('no reintenta create: responde 503 sin crear el usuario dos veces', async () => {
    const inner = new FlakyUserRepository();
    const repository = new ResilientUserRepository({ inner, policy: createPolicy() });

    await assert.rejects(() => repository.create({ username: 'ana', role: 'ORGANIZER' }), ServiceUnavailableError);
    assert.equal(inner.calls.create, 1);
  });

  test('un usuario duplicado sigue llegando como UserAlreadyExistsError', async () => {
    // Like PostgresUserRepository when the unique constraint rejects the insert.
    const inner = new InMemoryUserRepository();
    inner.create = async ({ username }) => {
      throw new UserAlreadyExistsError(username);
    };
    const repository = new ResilientUserRepository({ inner, policy: createPolicy() });

    await assert.rejects(() => repository.create({ username: 'ana', role: 'ORGANIZER' }), UserAlreadyExistsError);
  });
});
