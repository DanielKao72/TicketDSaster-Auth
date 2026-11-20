const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const BcryptPasswordHasher = require('./BcryptPasswordHasher');

const passwordHasher = new BcryptPasswordHasher();

describe('BcryptPasswordHasher', () => {
  test('genera un hash distinto al password original', async () => {
    const hash = await passwordHasher.hash('mySecret123');
    assert.notEqual(hash, 'mySecret123');
    assert.equal(hash.startsWith('$2b$'), true);
  });

  test('compare() retorna true con el password correcto', async () => {
    const hash = await passwordHasher.hash('mySecret123');
    const result = await passwordHasher.compare('mySecret123', hash);
    assert.equal(result, true);
  });

  test('compare() retorna false con el password incorrecto', async () => {
    const hash = await passwordHasher.hash('mySecret123');
    const result = await passwordHasher.compare('wrongPassword', hash);
    assert.equal(result, false);
  });
});