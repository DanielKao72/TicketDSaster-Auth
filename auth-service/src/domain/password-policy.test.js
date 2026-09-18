const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { validatePasswordPolicy } = require('./password-policy');
const DomainError = require('./errors/DomainError');

describe('password-policy', () => {
  test('no lanza error con un password de 8 caracteres o más', () => {
    assert.doesNotThrow(() => validatePasswordPolicy('mySecret123'));
  });

  test('lanza DomainError con un password de menos de 8 caracteres', () => {
    assert.throws(() => validatePasswordPolicy('short'), DomainError);
  });

  test('lanza DomainError si el password está vacío o no existe', () => {
    assert.throws(() => validatePasswordPolicy(''), DomainError);
    assert.throws(() => validatePasswordPolicy(undefined), DomainError);
  });
});