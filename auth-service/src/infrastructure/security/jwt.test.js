const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const config = require("../../config/env");
const { generateToken, verifyToken } = require("./jwt");

describe("JWT Security Module (SETUP-NJ-T4 & PA-08-T1)", () => {
  const mockUser = {
    userId: "usr-123e4567-e89b-12d3-a456-426614174000",
    role: "VENUE_OWNER",
  };

  it("genera un token firmado válido con claims sub y role", () => {
    const token = generateToken(mockUser);
    assert.ok(typeof token === "string");

    const decoded = jwt.decode(token);
    assert.equal(decoded.sub, mockUser.userId);
    assert.equal(decoded.role, mockUser.role);
  });

  it("establece una expiración de exactamente 8 horas (28800 segundos)", () => {
    const token = generateToken(mockUser);
    const decoded = jwt.decode(token);

    // exp - iat debe ser igual a expiresInSeconds (28800s)
    const duration = decoded.exp - decoded.iat;
    assert.equal(duration, config.jwt.expiresInSeconds);
    assert.equal(duration, 28800);
  });

  it("falla si falta userId o role al generar el token", () => {
    assert.throws(() => generateToken({ role: "ORGANIZER" }), /userId/);
    assert.throws(() => generateToken({ userId: "123" }), /role/);
  });

  it("verifica un token legítimo correctamente", () => {
    const token = generateToken(mockUser);
    const verified = verifyToken(token);

    assert.equal(verified.sub, mockUser.userId);
    assert.equal(verified.role, mockUser.role);
  });

  it("rechaza un token firmado con una firma inválida", () => {
    const fakeToken = jwt.sign(
      { sub: "fake", role: "ORGANIZER" },
      "wrong-secret",
    );
    assert.throws(() => verifyToken(fakeToken), jwt.JsonWebTokenError);
  });
});
