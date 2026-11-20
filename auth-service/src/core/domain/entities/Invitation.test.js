const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const Invitation = require('./Invitation');
const DomainError = require('../errors/DomainError');

describe('Invitation', () => {
  test('crea una Invitation válida con valores por defecto', () => {
    const invitation = new Invitation({ code: 'abc', role: 'VENUE_OWNER' });

    assert.equal(invitation.code, 'abc');
    assert.equal(invitation.role, 'VENUE_OWNER');
    assert.equal(invitation.used, false);
    assert.equal(invitation.usedAt, null);
    assert.ok(invitation.createdAt instanceof Date);
  });

  test('falla si falta code', () => {
    assert.throws(
      () => new Invitation({ role: 'ORGANIZER' }),
      DomainError,
    );
  });

  test('falla si el rol no es VENUE_OWNER ni ORGANIZER', () => {
    assert.throws(
      () => new Invitation({ code: 'abc', role: 'ADMIN' }),
      DomainError,
    );
  });

  // PA-03: it is only marked consumed once the full registration succeeds.
  test('markUsed() marca la invitación como usada y registra usedAt', () => {
    const invitation = new Invitation({ code: 'abc', role: 'ORGANIZER' });

    invitation.markUsed();

    assert.equal(invitation.used, true);
    assert.ok(invitation.usedAt instanceof Date);
  });

  // PA-03: retrying an already-consumed code must fail explicitly.
  test('markUsed() falla si la invitación ya fue usada', () => {
    const invitation = new Invitation({ code: 'abc', role: 'ORGANIZER' });
    invitation.markUsed();

    assert.throws(() => invitation.markUsed(), DomainError);
  });

  test('permite reconstruir una invitación ya usada desde persistencia', () => {
    const usedAt = new Date('2026-01-01T00:00:00.000Z');
    const invitation = new Invitation({
      code: 'abc',
      role: 'ORGANIZER',
      used: true,
      usedAt,
    });

    assert.equal(invitation.used, true);
    assert.equal(invitation.usedAt, usedAt);
    assert.throws(() => invitation.markUsed(), DomainError);
  });
});
