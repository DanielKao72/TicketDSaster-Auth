const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const createApp = require("../../../app");
const { generateToken } = require("../../security/jwt");

describe("PA-08-T2: Downstream JWT verification contract & JWKS", () => {
  const app = createApp();
  let server;
  let baseUrl;

  it("inicia el servidor de prueba", async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  it("POST /auth/validate valida un token legítimo y devuelve claims sub y role", async () => {
    const token = generateToken({ userId: "usr-999", role: "ORGANIZER" });

    const res = await fetch(`${baseUrl}/auth/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.valid, true);
    assert.equal(body.sub, "usr-999");
    assert.equal(body.role, "ORGANIZER");
  });

  it("POST /auth/validate rechaza un token alterado o inválido con 401", async () => {
    const res = await fetch(`${baseUrl}/auth/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "token-invalido.falso.firma" }),
    });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.valid, false);
  });

  it("GET /.well-known/jwks.json entrega el contrato simétrico activo para downstream", async () => {
    const res = await fetch(`${baseUrl}/.well-known/jwks.json`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.keys));
    assert.equal(body.keys[0].alg, "HS256");
  });

  it("cierra el servidor de prueba", async () => {
    await new Promise((resolve) => server.close(resolve));
  });
});
