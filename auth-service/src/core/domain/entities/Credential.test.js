const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const Credential = require('./Credential');
const DomainError = require('../errors/DomainError');

describe('Credential', () => {
  test('crea un Credential válido con userId y passwordHash', () => {
    const credential = new Credential({ userId: '1', passwordHash: '$2b$10$hashedvalue' });

    assert.equal(credential.userId, '1');
    assert.equal(credential.passwordHash, '$2b$10$hashedvalue');
  });

  test('falla si falta userId', () => {
    assert.throws(
      () => new Credential({ passwordHash: '$2b$10$hashedvalue' }),
      DomainError,
    );
  });

  test('falla si falta passwordHash', () => {
    assert.throws(
      () => new Credential({ userId: '1' }),
      DomainError,
    );
  });

  // PA-06: plaintext is never persisted; Credential must only accept
  // the already-computed hash — no "password" field should exist on the entity.
  test('no expone un campo password en texto plano', () => {
    const credential = new Credential({ userId: '1', passwordHash: '$2b$10$hashedvalue' });
    assert.equal('password' in credential, false);
  });
});
