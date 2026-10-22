const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const PasswordPolicy = require('./PasswordPolicy');
const DomainError = require('./errors/DomainError');

describe('PasswordPolicy', () => {
  test('no lanza error con un password de 8 caracteres o más', () => {
    assert.doesNotThrow(() => PasswordPolicy.validate('mySecret123'));
  });

  test('lanza DomainError con un password de menos de 8 caracteres', () => {
    assert.throws(() => PasswordPolicy.validate('short'), DomainError);
  });

  test('lanza DomainError si el password está vacío o no existe', () => {
    assert.throws(() => PasswordPolicy.validate(''), DomainError);
    assert.throws(() => PasswordPolicy.validate(undefined), DomainError);
  });

  test('lanza DomainError si el password no es un string', () => {
    assert.throws(() => PasswordPolicy.validate(12345678), DomainError);
    assert.throws(() => PasswordPolicy.validate(['12345678']), DomainError);
  });
});