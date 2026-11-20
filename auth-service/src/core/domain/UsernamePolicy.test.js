const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const UsernamePolicy = require('./UsernamePolicy');
const DomainError = require('./errors/DomainError');

describe('UsernamePolicy', () => {
  test('normalize quita los espacios de los extremos', () => {
    assert.equal(UsernamePolicy.normalize('  venue.owner_1  '), 'venue.owner_1');
  });

  test('acepta letras, dígitos, punto, guion bajo y guion', () => {
    for (const username of ['abc', 'Venue.Owner_1', 'org-2026', 'a'.repeat(50)]) {
      assert.doesNotThrow(() => UsernamePolicy.validate(username), username);
    }
  });

  test('rechaza usernames de menos de 3 o más de 50 caracteres', () => {
    for (const username of ['', 'ab', 'a'.repeat(51)]) {
      assert.throws(() => UsernamePolicy.validate(username), DomainError, username);
    }
  });

  test('rechaza espacios y caracteres fuera del conjunto permitido', () => {
    for (const username of ['   ', 'venue owner', 'josé', 'user@mail.com', 'a/b']) {
      assert.throws(() => UsernamePolicy.validate(username), /may only contain/, username);
    }
  });

  test('rechaza valores que no son string', () => {
    assert.throws(() => UsernamePolicy.validate(123), DomainError);
    assert.throws(() => UsernamePolicy.validate(undefined), DomainError);
  });
});
