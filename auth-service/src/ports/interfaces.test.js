const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  UserRepository,
  CredentialRepository,
  InvitationRepository,
  PasswordHasher,
  TokenService,
  CodeGenerator,
  InvitationExpirationStore,
  UnitOfWork,
} = require('./interfaces');
const InMemoryUserRepository = require('../adapters/repositories/InMemoryUserRepository');
const InMemoryCredentialRepository = require('../adapters/repositories/InMemoryCredentialRepository');
const InMemoryInvitationRepository = require('../adapters/repositories/InMemoryInvitationRepository');
const InMemoryInvitationExpirationStore = require('../adapters/repositories/InMemoryInvitationExpirationStore');
const InMemoryUnitOfWork = require('../adapters/repositories/InMemoryUnitOfWork');
const PostgresUserRepository = require('../adapters/repositories/PostgresUserRepository');
const PostgresCredentialRepository = require('../adapters/repositories/PostgresCredentialRepository');
const PostgresInvitationRepository = require('../adapters/repositories/PostgresInvitationRepository');
const PostgresUnitOfWork = require('../adapters/repositories/PostgresUnitOfWork');
const RedisInvitationExpirationStore = require('../adapters/services/RedisInvitationExpirationStore');
const BcryptPasswordHasher = require('../adapters/services/BcryptPasswordHasher');
const JwtTokenService = require('../adapters/services/JwtTokenService');
const InvitationCodeGenerator = require('../adapters/services/InvitationCodeGenerator');
const ResilientUserRepository = require('../adapters/resilience/ResilientUserRepository');
const ResilientCredentialRepository = require('../adapters/resilience/ResilientCredentialRepository');
const ResilientInvitationRepository = require('../adapters/resilience/ResilientInvitationRepository');
const ResilientUnitOfWork = require('../adapters/resilience/ResilientUnitOfWork');
const ResilientInvitationExpirationStore = require('../adapters/resilience/ResilientInvitationExpirationStore');

describe('ports', () => {
  test('cada adaptador real implementa su puerto', () => {
    assert.ok(new InMemoryUserRepository() instanceof UserRepository);
    assert.ok(new InMemoryCredentialRepository() instanceof CredentialRepository);
    assert.ok(new InMemoryInvitationRepository() instanceof InvitationRepository);
    assert.ok(new BcryptPasswordHasher() instanceof PasswordHasher);
    assert.ok(new JwtTokenService({ secret: 's', expiresInSeconds: 60 }) instanceof TokenService);
    assert.ok(new InvitationCodeGenerator() instanceof CodeGenerator);
    assert.ok(new InMemoryInvitationExpirationStore() instanceof InvitationExpirationStore);
    assert.ok(new InMemoryUnitOfWork({}) instanceof UnitOfWork);
  });

  test('cada adaptador de Postgres y Redis implementa su puerto', () => {
    const db = { query: async () => ({ rows: [], rowCount: 0 }) };
    assert.ok(new PostgresUserRepository({ db }) instanceof UserRepository);
    assert.ok(new PostgresCredentialRepository({ db }) instanceof CredentialRepository);
    assert.ok(new PostgresInvitationRepository({ db }) instanceof InvitationRepository);
    assert.ok(new PostgresUnitOfWork({ pool: {} }) instanceof UnitOfWork);
    assert.ok(new RedisInvitationExpirationStore({ redisClient: {} }) instanceof InvitationExpirationStore);
  });

  test('cada decorador de resiliencia implementa su puerto', () => {
    const deps = { inner: {}, policy: {} };
    assert.ok(new ResilientUserRepository(deps) instanceof UserRepository);
    assert.ok(new ResilientCredentialRepository(deps) instanceof CredentialRepository);
    assert.ok(new ResilientInvitationRepository(deps) instanceof InvitationRepository);
    assert.ok(new ResilientUnitOfWork(deps) instanceof UnitOfWork);
    assert.ok(new ResilientInvitationExpirationStore(deps) instanceof InvitationExpirationStore);
  });

  test('un puerto sin implementar falla de forma explícita', async () => {
    await assert.rejects(() => new UserRepository().findByUsername('x'), /Not implemented: UserRepository.findByUsername/);
    await assert.rejects(() => new PasswordHasher().hash('x'), /Not implemented: PasswordHasher.hash/);
    assert.throws(() => new TokenService().verify('x'), /Not implemented: TokenService.verify/);
    assert.throws(() => new CodeGenerator().generate(), /Not implemented: CodeGenerator.generate/);
    await assert.rejects(() => new InvitationExpirationStore().isActive('x'), /Not implemented: InvitationExpirationStore.isActive/);
    await assert.rejects(() => new UnitOfWork().run(async () => {}), /Not implemented: UnitOfWork.run/);
  });
});
