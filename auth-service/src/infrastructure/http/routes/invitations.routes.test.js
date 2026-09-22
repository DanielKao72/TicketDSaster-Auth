const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const createApp = require('../../../app');
const InMemoryInvitationRepository = require('../../persistence/in-memory-invitation.repository');

// PA-01-T1: integration test over the real Express app with a clean in-memory
// store. The staff credential guard (PA-01-T2) is not mounted yet, so these
// requests intentionally carry no staff credential.
describe('POST /invitations', () => {
  let server;
  let baseUrl;
  let invitationRepository;

  async function postInvitation(body) {
    return fetch(`${baseUrl}/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  before(async () => {
    invitationRepository = new InMemoryInvitationRepository();
    server = http.createServer(createApp({ invitationRepository }));

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('responde 201 con el código generado para VENUE_OWNER', async () => {
    const response = await postInvitation({ role: 'VENUE_OWNER' });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.role, 'VENUE_OWNER');
    assert.match(body.code, /^[A-HJ-NP-TV-Z2-9]{4}-[A-HJ-NP-TV-Z2-9]{4}-[A-HJ-NP-TV-Z2-9]{4}$/);
    assert.ok(body.createdAt);
  });

  test('responde 201 con el código generado para ORGANIZER', async () => {
    const response = await postInvitation({ role: 'ORGANIZER' });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.role, 'ORGANIZER');
  });

  // PA-01: generation persists the invitation in the mock store.
  test('persiste la invitación generada en el store', async () => {
    const response = await postInvitation({ role: 'VENUE_OWNER' });
    const body = await response.json();

    const invitation = await invitationRepository.findByCode(body.code);

    assert.ok(invitation);
    assert.equal(invitation.role, 'VENUE_OWNER');
    assert.equal(invitation.used, false);
  });

  // PA-01.2: every invitation code generated is unique.
  test('genera un código distinto en cada solicitud', async () => {
    const first = await (await postInvitation({ role: 'ORGANIZER' })).json();
    const second = await (await postInvitation({ role: 'ORGANIZER' })).json();

    assert.notEqual(first.code, second.code);
  });

  test('responde 400 si el rol no es VENUE_OWNER ni ORGANIZER', async () => {
    const response = await postInvitation({ role: 'ADMIN' });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Invalid request body');
    assert.ok(body.details.role);
  });

  test('responde 400 si no se envía el rol', async () => {
    const response = await postInvitation({});

    assert.equal(response.status, 400);
  });

  test('no expone la generación por GET /invitations', async () => {
    const response = await fetch(`${baseUrl}/invitations`);

    assert.equal(response.status, 404);
  });
});
