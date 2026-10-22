const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const createApp = require('../../../app');
const { staff } = require('../../../config/env');

// End-to-end partner flow over the real Express app: invitation (PA-01) →
// registration (PA-02..PA-06) → login (PA-07) → downstream validation (PA-08).
// The tests share one app instance and run in order. Invitations are generated
// with the configured staff credential (PA-01-T2), like a real staff member.
describe('Partner flow: invitation → register → login → validate', () => {
  let server;
  let baseUrl;
  let invitationCode;
  let accessToken;
  let registeredUserId;

  const staffAuthorization = `Basic ${Buffer.from(`${staff.username}:${staff.password}`).toString('base64')}`;

  async function post(path, body, headers = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  // PA-01-T2: only staff can generate invitations.
  function postInvitation(body) {
    return post('/invitations', body, { Authorization: staffAuthorization });
  }

  before(async () => {
    server = http.createServer(createApp());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('POST /invitations rechaza con 401 a quien no es staff', async () => {
    const { status } = await post('/invitations', { role: 'ORGANIZER' });

    assert.equal(status, 401);
  });

  test('POST /invitations genera un codigo ORGANIZER', async () => {
    const { status, body } = await postInvitation({ role: 'ORGANIZER' });

    assert.equal(status, 201);
    invitationCode = body.code;
  });

  test('POST /auth/register rechaza un password corto con 400', async () => {
    const { status } = await post('/auth/register', {
      username: 'organizer1',
      password: 'short',
      invitationCode,
    });

    assert.equal(status, 400);
  });

  test('POST /auth/register rechaza un password no string con 400 y no bloquea el username', async () => {
    const { status, body } = await post('/auth/register', {
      username: 'organizer1',
      password: 12345678,
      invitationCode,
    });

    assert.equal(status, 400);
    assert.equal(body.error, 'username, password and invitationCode must be strings');
  });

  test('POST /auth/register registra al partner con el rol de la invitacion', async () => {
    const { status, body } = await post('/auth/register', {
      username: 'organizer1',
      password: 'mySecret123',
      invitationCode,
    });

    assert.equal(status, 201);
    assert.equal(body.username, 'organizer1');
    assert.equal(body.role, 'ORGANIZER');
    registeredUserId = body.id;
  });

  test('POST /auth/register responde 409 si el username ya existe', async () => {
    const { body: invitation } = await postInvitation({ role: 'VENUE_OWNER' });
    const { status } = await post('/auth/register', {
      username: 'organizer1',
      password: 'mySecret123',
      invitationCode: invitation.code,
    });

    assert.equal(status, 409);
  });

  test('POST /auth/register responde 400 si el codigo ya fue usado', async () => {
    const { status } = await post('/auth/register', {
      username: 'organizer2',
      password: 'mySecret123',
      invitationCode,
    });

    assert.equal(status, 400);
  });

  test('POST /auth/login responde 401 con password incorrecto', async () => {
    const { status } = await post('/auth/login', { username: 'organizer1', password: 'wrongPassword' });

    assert.equal(status, 401);
  });

  test('POST /auth/login responde 400 con un password no string', async () => {
    const { status, body } = await post('/auth/login', { username: 'organizer1', password: 12345678 });

    assert.equal(status, 400);
    assert.equal(body.error, 'username and password must be strings');
  });

  test('POST /auth/login devuelve un JWT Bearer', async () => {
    const { status, body } = await post('/auth/login', { username: 'organizer1', password: 'mySecret123' });

    assert.equal(status, 200);
    assert.equal(body.tokenType, 'Bearer');
    assert.equal(typeof body.accessToken, 'string');
    assert.ok(body.expiresIn > 0);
    accessToken = body.accessToken;
  });

  test('POST /auth/validate acepta el token emitido con sub y role del partner', async () => {
    const { status, body } = await post('/auth/validate', { token: accessToken });

    assert.equal(status, 200);
    assert.equal(body.valid, true);
    assert.equal(body.sub, registeredUserId);
    assert.equal(body.role, 'ORGANIZER');
  });
});
