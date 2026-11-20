const { test, describe, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

const config = require('../../infrastructure/config/Env');
const PostgresConnection = require('../../infrastructure/database/PostgresConnection');
const Migrator = require('../../infrastructure/database/Migrator');
const PostgresUserRepository = require('./PostgresUserRepository');
const PostgresCredentialRepository = require('./PostgresCredentialRepository');
const UserAlreadyExistsError = require('../../core/use-cases/errors/UserAlreadyExistsError');
const { ROLES } = require('../../core/domain/Roles');

// Integration: needs a real Postgres (docker compose up postgres) and
// RUN_INTEGRATION_TESTS=true. Skipped otherwise, e.g. in CI.
// Each test uses its own usernames and codes: test files run in parallel
// against the same database, so tables are never truncated.
const unique = (prefix) => `${prefix}-${randomUUID()}`;

describe('PostgresUserRepository + PostgresCredentialRepository', { skip: !config.integrationTests }, () => {
  let connection;
  let userRepository;
  let credentialRepository;

  before(async () => {
    connection = new PostgresConnection(config.database);
    await new Migrator({ pool: connection.pool }).migrate();
    userRepository = new PostgresUserRepository({ db: connection.pool });
    credentialRepository = new PostgresCredentialRepository({ db: connection.pool });
  });

  after(async () => {
    await connection.close();
  });

  test('crea y encuentra un usuario por id y por username', async () => {
    const username = unique('ana');
    const created = await userRepository.create({ username, role: ROLES.ORGANIZER });

    assert.equal((await userRepository.findById(created.id)).username, username);
    assert.equal((await userRepository.findByUsername(username)).id, created.id);
    assert.equal(await userRepository.findByUsername(unique('nadie')), null);
  });

  test('PA-05: un username duplicado lanza UserAlreadyExistsError', async () => {
    const username = unique('ana');
    await userRepository.create({ username, role: ROLES.ORGANIZER });

    await assert.rejects(() => userRepository.create({ username, role: ROLES.VENUE_OWNER }), UserAlreadyExistsError);
  });

  test('PA-06: guarda el hash en users.password_hash y lo lee como Credential', async () => {
    const user = await userRepository.create({ username: unique('ana'), role: ROLES.ORGANIZER });

    assert.equal(await credentialRepository.findByUserId(user.id), null);
    await credentialRepository.create({ userId: user.id, passwordHash: 'hash-1' });

    const credential = await credentialRepository.findByUserId(user.id);
    assert.equal(credential.passwordHash, 'hash-1');
    assert.equal('passwordHash' in (await userRepository.findById(user.id)), false);
  });
});
