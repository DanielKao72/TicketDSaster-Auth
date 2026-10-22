const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  UserRepository,
  CredentialRepository,
  InvitationRepository,
  PasswordHasher,
  TokenService,
  CodeGenerator,
} = require('./interfaces');
const InMemoryUserRepository = require('../adapters/repositories/InMemoryUserRepository');
const InMemoryCredentialRepository = require('../adapters/repositories/InMemoryCredentialRepository');
const InMemoryInvitationRepository = require('../adapters/repositories/InMemoryInvitationRepository');
const BcryptPasswordHasher = require('../adapters/services/BcryptPasswordHasher');
const JwtTokenService = require('../adapters/services/JwtTokenService');
const InvitationCodeGenerator = require('../adapters/services/InvitationCodeGenerator');

describe('ports', () => {
  test('cada adaptador real implementa su puerto', () => {
    assert.ok(new InMemoryUserRepository() instanceof UserRepository);
    assert.ok(new InMemoryCredentialRepository() instanceof CredentialRepository);
    assert.ok(new InMemoryInvitationRepository() instanceof InvitationRepository);
    assert.ok(new BcryptPasswordHasher() instanceof PasswordHasher);
    assert.ok(new JwtTokenService({ secret: 's', expiresInSeconds: 60 }) instanceof TokenService);
    assert.ok(new InvitationCodeGenerator() instanceof CodeGenerator);
  });

  test('un puerto sin implementar falla de forma explícita', async () => {
    await assert.rejects(() => new UserRepository().findByUsername('x'), /Not implemented: UserRepository.findByUsername/);
    await assert.rejects(() => new PasswordHasher().hash('x'), /Not implemented: PasswordHasher.hash/);
    assert.throws(() => new TokenService().verify('x'), /Not implemented: TokenService.verify/);
    assert.throws(() => new CodeGenerator().generate(), /Not implemented: CodeGenerator.generate/);
  });
});
