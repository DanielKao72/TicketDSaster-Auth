const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const PostgresConnection = require('./PostgresConnection');

// The pool only connects on its first query, so no database is needed here.
describe('PostgresConnection', () => {
  test('un error de un cliente inactivo se registra y no tumba el proceso', async () => {
    const logged = [];
    const connection = new PostgresConnection(
      { url: 'postgres://auth:auth@localhost:1/auth' },
      { logger: { error: (...args) => logged.push(args) } },
    );

    // Without a listener, emit('error') throws (Node's unhandled 'error' event).
    assert.doesNotThrow(() =>
      connection.pool.emit('error', new Error('terminating connection due to administrator command')),
    );
    assert.equal(logged.length, 1);
    assert.match(logged[0].join(' '), /terminating connection due to administrator command/);

    await connection.close();
  });
});
