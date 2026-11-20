const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const InMemoryInvitationExpirationStore = require('./InMemoryInvitationExpirationStore');

describe('InMemoryInvitationExpirationStore', () => {
  function storeWithClock() {
    const clock = { now: 1_000_000 };
    return { clock, store: new InMemoryInvitationExpirationStore({ now: () => clock.now }) };
  }

  test('un codigo nunca activado no esta activo', async () => {
    const { store } = storeWithClock();

    assert.equal(await store.isActive('CODE'), false);
  });

  test('PA-03: el codigo esta activo hasta que pasa su TTL', async () => {
    const { clock, store } = storeWithClock();
    await store.markActive('CODE', 300);

    clock.now += 299_999;
    assert.equal(await store.isActive('CODE'), true);

    clock.now += 1;
    assert.equal(await store.isActive('CODE'), false);
  });

  test('revoke desactiva el codigo antes de su TTL', async () => {
    const { store } = storeWithClock();
    await store.markActive('CODE', 300);

    await store.revoke('CODE');

    assert.equal(await store.isActive('CODE'), false);
  });
});
