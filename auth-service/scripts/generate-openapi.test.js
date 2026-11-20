const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildSpec } = require('./generate-openapi');

// The published spec (release.yml) is the contract consumers read: every
// route the service exposes must be documented.
describe('OpenAPI spec', () => {
  const spec = buildSpec();

  test('documenta todas las rutas del servicio', () => {
    assert.deepEqual(
      Object.entries(spec.paths)
        .flatMap(([path, operations]) => Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`))
        .sort(),
      [
        'GET /.well-known/jwks.json',
        'GET /health',
        'POST /auth/login',
        'POST /auth/register',
        'POST /auth/validate',
        'POST /invitations',
      ],
    );
  });

  test('cada $ref apunta a un componente definido', () => {
    const refs = JSON.stringify(spec).match(/"\$ref":"[^"]+"/g) ?? [];
    for (const ref of refs) {
      const [, section, name] = ref.match(/#\/components\/(\w+)\/(\w+)/);
      assert.ok(spec.components[section]?.[name], `${ref} no está definido`);
    }
  });

  test('POST /invitations exige la credencial de staff', () => {
    assert.deepEqual(spec.paths['/invitations'].post.security, [{ staffBasicAuth: [] }]);
  });
});
