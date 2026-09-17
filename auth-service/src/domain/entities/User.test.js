const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const User = require('./User');
const DomainError = require('../errors/DomainError');

describe('User', () => {
  test('crea un User válido con los campos requeridos', () => {
    const user = new User({ id: '1', username: 'juan', role: 'ORGANIZER' });

    assert.equal(user.id, '1');
    assert.equal(user.username, 'juan');
    assert.equal(user.role, 'ORGANIZER');
    assert.ok(user.createdAt instanceof Date);
  });

  test('acepta el rol VENUE_OWNER', () => {
    const user = new User({ id: '1', username: 'ana', role: 'VENUE_OWNER' });
    assert.equal(user.role, 'VENUE_OWNER');
  });

  test('respeta un createdAt explícito (reconstrucción desde persistencia)', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const user = new User({ id: '1', username: 'juan', role: 'ORGANIZER', createdAt });

    assert.equal(user.createdAt, createdAt);
  });

  test('falla si falta id', () => {
    assert.throws(
      () => new User({ username: 'juan', role: 'ORGANIZER' }),
      DomainError,
    );
  });

  test('falla si falta username', () => {
    assert.throws(
      () => new User({ id: '1', role: 'ORGANIZER' }),
      DomainError,
    );
  });

  test('falla si el rol no es VENUE_OWNER ni ORGANIZER', () => {
    assert.throws(
      () => new User({ id: '1', username: 'juan', role: 'ADMIN' }),
      DomainError,
    );
  });

  test('falla si el rol viene vacío/undefined', () => {
    assert.throws(
      () => new User({ id: '1', username: 'juan' }),
      DomainError,
    );
  });
});
