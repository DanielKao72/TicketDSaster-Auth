const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');

const ResiliencePolicy = require('./ResiliencePolicy');
const ServiceUnavailableError = require('../../core/use-cases/errors/ServiceUnavailableError');
const UserAlreadyExistsError = require('../../core/use-cases/errors/UserAlreadyExistsError');

const silentLogger = { warn: () => {} };

function createPolicy({ timeoutMs = 50, maxAttempts = 2, consecutiveFailures = 3, halfOpenAfterMs = 60 } = {}) {
  return new ResiliencePolicy({
    name: 'redis',
    timeoutMs,
    retry: { maxAttempts, initialDelayMs: 1, maxDelayMs: 2 },
    breaker: { consecutiveFailures, halfOpenAfterMs },
    logger: silentLogger,
  });
}

// Counts calls and fails the first `failures` of them.
function flakyOperation(failures, result = 'ok') {
  const operation = async () => {
    operation.calls += 1;
    if (operation.calls <= failures) {
      throw new Error('connection reset');
    }
    return result;
  };
  operation.calls = 0;
  return operation;
}

describe('ResiliencePolicy', () => {
  test('devuelve el resultado de la llamada cuando sale bien', async () => {
    const policy = createPolicy();

    assert.equal(await policy.execute(async () => 'ok'), 'ok');
    assert.equal(policy.state, 'closed');
  });

  test('Timeout: una llamada lenta termina en ServiceUnavailableError', async () => {
    const policy = createPolicy({ timeoutMs: 10, maxAttempts: 0 });

    await assert.rejects(
      () => policy.execute(() => sleep(200, 'tarde')),
      (error) => error instanceof ServiceUnavailableError && error.dependency === 'redis',
    );
  });

  test('Retry: un fallo transitorio se reintenta y la llamada acaba bien', async () => {
    const policy = createPolicy({ maxAttempts: 2 });
    const operation = flakyOperation(2);

    assert.equal(await policy.execute(operation), 'ok');
    assert.equal(operation.calls, 3);
  });

  test('Retry: una operacion no idempotente se intenta una sola vez', async () => {
    const policy = createPolicy({ maxAttempts: 2 });
    const operation = flakyOperation(1);

    await assert.rejects(() => policy.execute(operation, { idempotent: false }), ServiceUnavailableError);
    assert.equal(operation.calls, 1);
  });

  test('un error de negocio se propaga sin reintentos ni abrir el circuito', async () => {
    const policy = createPolicy({ consecutiveFailures: 1 });
    let calls = 0;
    const operation = async () => {
      calls += 1;
      throw new UserAlreadyExistsError('ana');
    };

    await assert.rejects(() => policy.execute(operation), UserAlreadyExistsError);
    await assert.rejects(() => policy.execute(operation), UserAlreadyExistsError);
    assert.equal(calls, 2);
    assert.equal(policy.state, 'closed');
  });

  test('CircuitBreaker: tras N fallos se abre y deja de llamar al store', async () => {
    const policy = createPolicy({ maxAttempts: 0, consecutiveFailures: 3 });
    const operation = flakyOperation(Infinity);

    for (let i = 0; i < 3; i += 1) {
      await assert.rejects(() => policy.execute(operation), ServiceUnavailableError);
    }
    assert.equal(policy.state, 'open');

    await assert.rejects(() => policy.execute(operation), ServiceUnavailableError);
    assert.equal(operation.calls, 3);
  });

  test('CircuitBreaker: pasa a semiabierto y se cierra si la llamada de prueba sale bien', async () => {
    const policy = createPolicy({ maxAttempts: 0, consecutiveFailures: 1, halfOpenAfterMs: 30 });

    await assert.rejects(() => policy.execute(flakyOperation(1)), ServiceUnavailableError);
    assert.equal(policy.state, 'open');

    await sleep(50);
    assert.equal(await policy.execute(async () => 'ok'), 'ok');
    assert.equal(policy.state, 'closed');
  });

  test('Fallback: una operacion puede devolver un valor en lugar del 503', async () => {
    const policy = createPolicy({ maxAttempts: 0 });

    const result = await policy.execute(flakyOperation(1), { fallback: () => 'por defecto' });

    assert.equal(result, 'por defecto');
  });

  test('el 503 indica cuando reintentar segun el tiempo de semiapertura', async () => {
    const policy = createPolicy({ maxAttempts: 0, halfOpenAfterMs: 10000 });

    await assert.rejects(
      () => policy.execute(flakyOperation(1)),
      (error) => error.retryAfterSeconds === 10,
    );
  });
});
