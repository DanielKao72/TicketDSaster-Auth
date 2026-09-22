const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const generateInvitationCode = require('./invitation-code');

describe('generateInvitationCode', () => {
  test('genera un código en grupos de 4 caracteres', () => {
    assert.match(generateInvitationCode(), /^[A-HJ-NP-TV-Z2-9]{4}-[A-HJ-NP-TV-Z2-9]{4}-[A-HJ-NP-TV-Z2-9]{4}$/);
  });

  // PA-01: staff dictate the code to the partner, so ambiguous characters
  // (0/O, 1/I/L) must never appear.
  test('no usa caracteres ambiguos (0, O, 1, I, L)', () => {
    for (let index = 0; index < 200; index += 1) {
      assert.doesNotMatch(generateInvitationCode(), /[01IOL]/);
    }
  });

  // PA-01.2: every invitation code generated is unique.
  test('genera códigos distintos en llamadas consecutivas', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInvitationCode()));

    assert.equal(codes.size, 500);
  });
});
