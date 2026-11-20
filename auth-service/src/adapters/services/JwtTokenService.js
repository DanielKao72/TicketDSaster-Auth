const jwt = require("jsonwebtoken");

const { TokenService } = require("../../ports/interfaces");

class JwtTokenService extends TokenService {
  // Contrato con los servicios downstream: HMAC-SHA256 con JWT_SECRET.
  static ALGORITHM = "HS256";

  /**
   * @param {object} options
   * @param {string} options.secret secreto HS256 compartido con los servicios downstream
   * @param {number} options.expiresInSeconds vigencia del token (8h por defecto en config)
   */
  constructor({ secret, expiresInSeconds }) {
    super();
    this.secret = secret;
    this.expiresInSeconds = expiresInSeconds;
  }

  /**
   * Genera un JWT firmado con los claims estándar del sistema.
   * Requisitos:
   * - sub: id del usuario
   * - role: rol del usuario (VENUE_OWNER | ORGANIZER | etc.)
   * - exp: vigencia fija de 8 horas (28800 segundos)
   */
  generate({ userId, role }) {
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

    return jwt.sign(payload, this.secret, {
      algorithm: JwtTokenService.ALGORITHM,
      expiresIn: this.expiresInSeconds,
    });
  }

  /**
   * Verifica y decodifica un JWT emitido por el servicio.
   * Solo acepta el algoritmo del contrato (HS256) y exige `exp`: un token
   * firmado con el secreto pero con otro algoritmo, o sin vencimiento, no
   * fue emitido por este servicio y se rechaza.
   */
  verify(token) {
    if (!token) {
      throw new Error("Token is required for verification");
    }

    const decoded = jwt.verify(token, this.secret, {
      algorithms: [JwtTokenService.ALGORITHM],
    });

    if (typeof decoded.exp !== "number") {
      throw new jwt.JsonWebTokenError("jwt exp is required");
    }

    return decoded;
  }
}

module.exports = JwtTokenService;
