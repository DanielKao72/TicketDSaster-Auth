const { test, describe, before, after } = require('node:test');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');

const config = require('../../infrastructure/config/Env');
const PostgresConnection = require('../../infrastructure/database/PostgresConnection');
const Migrator = require('../../infrastructure/database/Migrator');
const PostgresInvitationRepository = require('./PostgresInvitationRepository');
const Invitation = require('../../core/domain/entities/Invitation');
const InvalidInvitationError = require('../../core/use-cases/errors/InvalidInvitationError');
const { ROLES } = require('../../core/domain/Roles');

// Integration: needs a real Postgres and RUN_INTEGRATION_TESTS=true.
// Each test uses its own usernames and codes: test files run in parallel
// against the same database, so tables are never truncated.
const unique = (prefix) => `${prefix}-${randomUUID()}`;

describe('PostgresInvitationRepository', { skip: !config.integrationTests }, () => {
  let connection;
  let invitationRepository;

  before(async () => {
    connection = new PostgresConnection(config.database);
    await new Migrator({ pool: connection.pool }).migrate();
    invitationRepository = new PostgresInvitationRepository({ db: connection.pool });
  });

  after(async () => {
    await connection.close();
  });

  test('PA-01: guarda una invitacion nueva con used = false', async () => {
    const code = unique('CODE');
    await invitationRepository.save(new Invitation({ code, role: ROLES.ORGANIZER }));

    assert.equal(await invitationRepository.existsByCode(code), true);
    const stored = await invitationRepository.findByCode(code);
    assert.equal(stored.role, ROLES.ORGANIZER);
    assert.equal(stored.used, false);
    assert.equal(stored.usedAt, null);
  });

  test('PA-03: guarda el codigo como usado', async () => {
    const code = unique('CODE');
    const invitation = await invitationRepository.save(new Invitation({ code, role: ROLES.ORGANIZER }));

    invitation.markUsed();
    await invitationRepository.save(invitation);

    const stored = await invitationRepository.findByCode(code);
    assert.equal(stored.used, true);
    assert.ok(stored.usedAt instanceof Date);
  });

  test('PA-03: no deja consumir dos veces el mismo codigo', async () => {
    const code = unique('CODE');
    await invitationRepository.save(new Invitation({ code, role: ROLES.ORGANIZER }));
    const first = await invitationRepository.findByCode(code);
    const second = await invitationRepository.findByCode(code);

    first.markUsed();
    await invitationRepository.save(first);
    second.markUsed();

    await assert.rejects(() => invitationRepository.save(second), InvalidInvitationError);
  });

  test('devuelve null si el codigo no existe', async () => {
    const code = unique('NOPE');
    assert.equal(await invitationRepository.findByCode(code), null);
    assert.equal(await invitationRepository.existsByCode(code), false);
  });
});
