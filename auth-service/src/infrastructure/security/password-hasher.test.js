const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { hashPassword, comparePassword } = require('./password-hasher');

describe('password-hasher', () => {
  test('genera un hash distinto al password original', async () => {
    const hash = await hashPassword('mySecret123');
    assert.notEqual(hash, 'mySecret123');
    assert.equal(hash.startsWith('$2b$'), true);
  });

  test('comparePassword retorna true con el password correcto', async () => {
    const hash = await hashPassword('mySecret123');
    const result = await comparePassword('mySecret123', hash);
    assert.equal(result, true);
  });

  test('comparePassword retorna false con el password incorrecto', async () => {
    const hash = await hashPassword('mySecret123');
    const result = await comparePassword('wrongPassword', hash);
    assert.equal(result, false);
  });
});