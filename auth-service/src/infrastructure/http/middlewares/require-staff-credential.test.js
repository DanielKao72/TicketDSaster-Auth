const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const createRequireStaffCredential = require('./require-staff-credential');

const STAFF = { username: 'staff-admin', password: 'p4ss:with:colons' };

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

// Minimal stand-ins for the Express objects the middleware touches.
function buildResponse() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    set(name, value) {
      res.headers[name] = value;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function run(authorization, credentials = STAFF) {
  const requireStaffCredential = createRequireStaffCredential(credentials);
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const res = buildResponse();
  let nextCalls = 0;

  requireStaffCredential(req, res, () => {
    nextCalls += 1;
  });

  return { res, nextCalls };
}

describe('requireStaffCredential', () => {
  // PA-01.4: a valid staff credential reaches the handler.
  test('deja pasar la petición con la credencial de staff correcta', () => {
    const { res, nextCalls } = run(basic(STAFF.username, STAFF.password));

    assert.equal(nextCalls, 1);
    assert.equal(res.statusCode, null);
  });

  test('acepta el esquema Basic sin importar mayúsculas', () => {
    const header = basic(STAFF.username, STAFF.password).replace('Basic', 'basic');

    assert.equal(run(header).nextCalls, 1);
  });

  test('acepta contraseñas que contienen dos puntos', () => {
    assert.equal(run(basic(STAFF.username, 'p4ss:with:colons')).nextCalls, 1);
  });

  // PA-01.4: requests without a valid staff credential are rejected.
  test('responde 401 si no llega el header Authorization', () => {
    const { res, nextCalls } = run(undefined);

    assert.equal(nextCalls, 0);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Staff credential required');
  });

  test('responde 401 si la contraseña es incorrecta', () => {
    const { res, nextCalls } = run(basic(STAFF.username, 'wrong-password'));

    assert.equal(nextCalls, 0);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Invalid staff credential');
  });

  test('responde 401 si el username es incorrecto', () => {
    const { res, nextCalls } = run(basic('someone-else', STAFF.password));

    assert.equal(nextCalls, 0);
    assert.equal(res.statusCode, 401);
  });

  test('no revela si falló el username o la contraseña', () => {
    const wrongUsername = run(basic('someone-else', STAFF.password)).res;
    const wrongPassword = run(basic(STAFF.username, 'wrong-password')).res;

    assert.deepEqual(wrongUsername.body, wrongPassword.body);
  });

  test('responde 401 si el esquema no es Basic', () => {
    const { res, nextCalls } = run('Bearer some.jwt.token');

    assert.equal(nextCalls, 0);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Invalid staff credential');
  });

  test('responde 401 si Basic llega sin credencial', () => {
    assert.equal(run('Basic').res.statusCode, 401);
    assert.equal(run('Basic ').res.statusCode, 401);
  });

  test('responde 401 si la credencial no tiene el formato usuario:contraseña', () => {
    const header = `Basic ${Buffer.from('without-separator').toString('base64')}`;

    assert.equal(run(header).res.statusCode, 401);
  });

  test('responde 401 si el header trae partes de más', () => {
    const header = `${basic(STAFF.username, STAFF.password)} extra`;

    assert.equal(run(header).res.statusCode, 401);
  });

  test('responde 401 con las credenciales vacías', () => {
    assert.equal(run(basic('', '')).res.statusCode, 401);
  });

  test('anuncia el esquema Basic en WWW-Authenticate al rechazar', () => {
    const { res } = run(undefined);

    assert.match(res.headers['WWW-Authenticate'], /^Basic realm="D-Saster Staff"/);
  });

  // Fail closed: without a configured credential the app must not start.
  test('falla al crearse si falta la credencial configurada', () => {
    assert.throws(() => createRequireStaffCredential({ username: '', password: 'x' }), /not configured/);
    assert.throws(() => createRequireStaffCredential({ username: 'x', password: '' }), /not configured/);
    assert.throws(() => createRequireStaffCredential({}), /not configured/);
  });
});
