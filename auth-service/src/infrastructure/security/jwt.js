const jwt = require("jsonwebtoken");
const config = require("../../config/env");

/**
 * Genera un JWT firmado con los claims estándar del sistema.
 * Requisitos:
 * - sub: id del usuario
 * - role: rol del usuario (VENUE_OWNER | ORGANIZER | etc.)
 * - exp: vigencia fija de 8 horas (28800 segundos)
 */
function generateToken({ userId, role }) {
  if (!userId) {
    throw new Error("generateToken requires userId (sub)");
  }
  if (!role) {
    throw new Error("generateToken requires role");
  }

  const payload = {
    sub: userId,
    role,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresInSeconds,
  });
}

/**
 * Verifica y decodifica un JWT emitido por el servicio.
 */
function verifyToken(token) {
  if (!token) {
    throw new Error("Token is required for verification");
  }

  return jwt.verify(token, config.jwt.secret);
}

module.exports = {
  generateToken,
  verifyToken,
};
