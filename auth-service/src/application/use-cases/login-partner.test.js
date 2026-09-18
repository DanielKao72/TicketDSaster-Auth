const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { loginPartner, InvalidCredentialsError } = require('./login-partner');
const { hashPassword } = require('../../infrastructure/security/password-hasher');

function makeFakeUserRepository(user) {
  return { findByUsername: async (username) => (username === user.username ? user : null) };
}
function makeFakeCredentialRepository(credential) {
  return { findByUserId: async (userId) => (userId === credential.userId ? credential : null) };
}

describe('loginPartner', () => {
  test('retorna el usuario si username y password son correctos', async () => {
    const passwordHash = await hashPassword('mySecret123');
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
    const passwordHash = await hashPassword('mySecret123');
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
});
