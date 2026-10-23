const { test, describe, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

const config = require('../../infrastructure/config/Env');
const PostgresConnection = require('../../infrastructure/database/PostgresConnection');
const Migrator = require('../../infrastructure/database/Migrator');
const PostgresUnitOfWork = require('./PostgresUnitOfWork');
const PostgresUserRepository = require('./PostgresUserRepository');
const { ROLES } = require('../../core/domain/Roles');

// Integration: needs a real Postgres and RUN_INTEGRATION_TESTS=true.
// Each test uses its own usernames and codes: test files run in parallel
// against the same database, so tables are never truncated.
const unique = (prefix) => `${prefix}-${randomUUID()}`;

describe('PostgresUnitOfWork', { skip: !config.integrationTests }, () => {
  let connection;
  let unitOfWork;
  let userRepository;

  before(async () => {
    connection = new PostgresConnection(config.database);
    await new Migrator({ pool: connection.pool }).migrate();
    unitOfWork = new PostgresUnitOfWork({ pool: connection.pool });
    userRepository = new PostgresUserRepository({ db: connection.pool });
  });

  after(async () => {
    await connection.close();
  });

  test('confirma todas las escrituras y devuelve el resultado', async () => {
    const username = unique('ana');
    const user = await unitOfWork.run(async ({ userRepository: txUsers, credentialRepository }) => {
      const created = await txUsers.create({ username, role: ROLES.ORGANIZER });
      await credentialRepository.create({ userId: created.id, passwordHash: 'hash' });
      return created;
    });

    assert.equal((await userRepository.findByUsername(username)).id, user.id);
  });

  test('revierte todas las escrituras si algo falla', async () => {
    const username = unique('ana');
    await assert.rejects(
      () => unitOfWork.run(async ({ userRepository: txUsers }) => {
        await txUsers.create({ username, role: ROLES.ORGANIZER });
        throw new Error('boom');
      }),
      /boom/,
    );

    assert.equal(await userRepository.findByUsername(username), null);
  });
});
