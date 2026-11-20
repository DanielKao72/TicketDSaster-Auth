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

  test('exige al menos una letra y un dígito', () => {
    const message = /at least one letter and one digit/;
    assert.throws(() => PasswordPolicy.validate('12345678'), message);
    assert.throws(() => PasswordPolicy.validate('abcdefgh'), message);
    assert.doesNotThrow(() => PasswordPolicy.validate('abcdefg1'));
    assert.doesNotThrow(() => PasswordPolicy.validate('contraseña1'));
  });

  // bcrypt ignores everything past byte 72.
  test('rechaza passwords de más de 72 bytes', () => {
    assert.doesNotThrow(() => PasswordPolicy.validate(`a1${'b'.repeat(70)}`));
    assert.throws(() => PasswordPolicy.validate(`a1${'b'.repeat(71)}`), /at most 72 bytes/);
    // 36 two-byte characters plus a digit: 37 characters but 73 bytes.
    assert.throws(() => PasswordPolicy.validate(`${'ñ'.repeat(36)}1`), /at most 72 bytes/);
  });
});