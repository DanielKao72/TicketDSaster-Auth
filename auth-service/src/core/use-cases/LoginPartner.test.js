const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const LoginPartner = require('./LoginPartner');
const InvalidCredentialsError = require('./errors/InvalidCredentialsError');
const BcryptPasswordHasher = require('../../adapters/services/BcryptPasswordHasher');
const InMemoryUserRepository = require('../../adapters/repositories/InMemoryUserRepository');

const passwordHasher = new BcryptPasswordHasher();

// Builds the use case with the given stores and runs it with the remaining input.
function loginPartner({ userRepository, credentialRepository, ...input }) {
  return new LoginPartner({ userRepository, credentialRepository, passwordHasher }).execute(input);
}

function makeFakeUserRepository(user) {
  return { findByUsername: async (username) => (username === user.username ? user : null) };
}
function makeFakeCredentialRepository(credential) {
  return { findByUserId: async (userId) => (userId === credential.userId ? credential : null) };
}

describe('LoginPartner', () => {
  test('retorna el usuario si username y password son correctos', async () => {
    const passwordHash = await passwordHasher.hash('mySecret123');
    const user = { id: 'u1', username: 'venue1', role: 'VENUE_OWNER' };
    const credential = { userId: 'u1', passwordHash };

    const result = await loginPartner({
      username: 'venue1',
      password: 'mySecret123',
      userRepository: makeFakeUserRepository(user),
      credentialRepository: makeFakeCredentialRepository(credential),
    });

    assert.equal(result.id, 'u1');
  });

  test('lanza InvalidCredentialsError si el username no existe', async () => {
    const user = { id: 'u1', username: 'venue1', role: 'VENUE_OWNER' };
    const credential = { userId: 'u1', passwordHash: 'whatever' };

    await assert.rejects(
      () => loginPartner({
        username: 'no-existe',
        password: 'mySecret123',
        userRepository: makeFakeUserRepository(user),
        credentialRepository: makeFakeCredentialRepository(credential),
      }),
      InvalidCredentialsError,
    );
  });

  test('lanza InvalidCredentialsError si el password es incorrecto', async () => {
    const passwordHash = await passwordHasher.hash('mySecret123');
    const user = { id: 'u1', username: 'venue1', role: 'VENUE_OWNER' };
    const credential = { userId: 'u1', passwordHash };

    await assert.rejects(
      () => loginPartner({
        username: 'venue1',
        password: 'wrongPassword',
        userRepository: makeFakeUserRepository(user),
        credentialRepository: makeFakeCredentialRepository(credential),
      }),
      InvalidCredentialsError,
    );
  });

  // UsernamePolicy: login ignores case and surrounding whitespace.
  test('acepta el username sin distinguir mayúsculas ni espacios de los extremos', async () => {
    const userRepository = new InMemoryUserRepository();
    const user = await userRepository.create({ username: 'Venue1', role: 'VENUE_OWNER' });
    const credential = { userId: user.id, passwordHash: await passwordHasher.hash('mySecret123') };

    const result = await loginPartner({
      username: '  venue1 ',
      password: 'mySecret123',
      userRepository,
      credentialRepository: makeFakeCredentialRepository(credential),
    });

    assert.equal(result.id, user.id);
  });

  // PA-07: an unknown username pays the same bcrypt cost as a wrong password,
  // so the response time does not reveal which usernames exist.
  describe('sin fuga de usuarios por tiempo de respuesta', () => {
    function makeSpyHasher() {
      const calls = { hash: 0, compare: 0 };
      return {
        calls,
        hash: async () => {
          calls.hash += 1;
          return 'dummy-hash';
        },
        compare: async () => {
          calls.compare += 1;
          return false;
        },
      };
    }

    test('compara contra un hash ficticio si el username no existe', async () => {
      const spyHasher = makeSpyHasher();
      const login = new LoginPartner({
        userRepository: makeFakeUserRepository({ id: 'u1', username: 'venue1' }),
        credentialRepository: makeFakeCredentialRepository({ userId: 'u1', passwordHash: 'x' }),
        passwordHasher: spyHasher,
      });

      await assert.rejects(() => login.execute({ username: 'no-existe', password: 'x' }), InvalidCredentialsError);
      await assert.rejects(() => login.execute({ username: 'otro', password: 'x' }), InvalidCredentialsError);

      assert.equal(spyHasher.calls.compare, 2);
      assert.equal(spyHasher.calls.hash, 1, 'el hash ficticio se calcula una sola vez');
    });

    test('compara contra un hash ficticio si el usuario no tiene credencial', async () => {
      const spyHasher = makeSpyHasher();
      const login = new LoginPartner({
        userRepository: makeFakeUserRepository({ id: 'u1', username: 'venue1' }),
        credentialRepository: makeFakeCredentialRepository({ userId: 'otro', passwordHash: 'x' }),
        passwordHasher: spyHasher,
      });

      await assert.rejects(() => login.execute({ username: 'venue1', password: 'x' }), InvalidCredentialsError);

      assert.equal(spyHasher.calls.compare, 1);
    });
  });
});
