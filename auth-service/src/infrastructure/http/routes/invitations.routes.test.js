const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const createApp = require('../../../app');
const InMemoryInvitationRepository = require('../../persistence/in-memory-invitation.repository');

const STAFF = { username: 'test-staff', password: 'test-staff-password' };

function basicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

// PA-01-T1 / PA-01-T2: integration test over the real Express app with a clean
// in-memory store. The staff credential is injected, so the suite does not
// depend on the values in .env. Requests carry a valid staff credential unless
// a test says otherwise.
describe('POST /invitations', () => {
  let server;
  let baseUrl;
  let invitationRepository;
  let saveCalls;

  async function postInvitation(body, authorization = basicAuth(STAFF.username, STAFF.password)) {
    const headers = { 'Content-Type': 'application/json' };
    if (authorization) {
      headers.Authorization = authorization;
    }

    return fetch(`${baseUrl}/invitations`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  before(async () => {
    invitationRepository = new InMemoryInvitationRepository();

    // Counts how many invitations reach the store, to prove that a rejected
    // request never got to the handler.
    saveCalls = 0;
    const save = invitationRepository.save.bind(invitationRepository);
    invitationRepository.save = async (invitation) => {
      saveCalls += 1;
      return save(invitation);
    };

    server = http.createServer(createApp({ invitationRepository, staffCredentials: STAFF }));

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

  test('responde 400 si el body no es JSON válido', async () => {
    const response = await fetch(`${baseUrl}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(STAFF.username, STAFF.password),
      },
      body: '{"role": "ORGANIZER"',
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, 'Malformed JSON body');
  });

  test('no expone la generación por GET /invitations', async () => {
    const response = await fetch(`${baseUrl}/invitations`);

    assert.equal(response.status, 404);
  });

  // PA-01.4: generation requires a staff credential; requests without a valid
  // one are rejected before the handler runs.
  describe('sin credencial de staff válida', () => {
    // Sends the request and checks the 401 plus that nothing reached the store.
    async function assertRejected(send) {
      const savedBefore = saveCalls;
      const response = await send();
      const body = await response.json();

      assert.equal(response.status, 401);
      assert.ok(body.error);
      assert.match(response.headers.get('www-authenticate'), /^Basic realm=/);
      assert.equal(saveCalls, savedBefore);
    }

    test('responde 401 si no se envía credencial', async () => {
      await assertRejected(() => postInvitation({ role: 'ORGANIZER' }, null));
    });

    test('responde 401 si la contraseña de staff es incorrecta', async () => {
      await assertRejected(() => postInvitation(
        { role: 'ORGANIZER' },
        basicAuth(STAFF.username, 'wrong-password'),
      ));
    });

    test('responde 401 si el username de staff es incorrecto', async () => {
      await assertRejected(() => postInvitation(
        { role: 'ORGANIZER' },
        basicAuth('someone-else', STAFF.password),
      ));
    });

    test('responde 401 si la credencial no usa el esquema Basic', async () => {
      await assertRejected(() => postInvitation({ role: 'ORGANIZER' }, 'Bearer some.jwt.token'));
    });

    test('responde 401 y no 400 si el rol es inválido pero falta la credencial', async () => {
      await assertRejected(() => postInvitation({ role: 'ADMIN' }, null));
    });

    test('responde 401 y no 400 si el body está mal formado y falta la credencial', async () => {
      await assertRejected(() => fetch(`${baseUrl}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"role": "ORGANIZER"',
      }));
    });
  });
});
