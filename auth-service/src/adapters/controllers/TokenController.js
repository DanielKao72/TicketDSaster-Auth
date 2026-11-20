// Downstream JWT verification contract (PA-08-T2): POST /auth/validate and
// GET /.well-known/jwks.json.
class TokenController {
  /** @param {{ tokenService: import('../../ports/interfaces').TokenService }} deps */
  constructor({ tokenService }) {
    this.tokenService = tokenService;
  }

  validate = (req, res) => {
    const token =
      req.body?.token || req.headers.authorization?.replace(/^Bearer\s+/, "");

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    try {
      const decoded = this.tokenService.verify(token);
      return res.status(200).json({
        valid: true,
        sub: decoded.sub,
        role: decoded.role,
        exp: decoded.exp,
        iat: decoded.iat,
      });
    } catch (error) {
      return res.status(401).json({
        valid: false,
        error:
          error.name === "TokenExpiredError"
            ? "Token expired"
            : "Invalid token signature",
      });
    }
  };

  jwks = (req, res) => {
    // Contrato downstream: en MVP-03 la estrategia es simétrica (HMAC-SHA256)
    return res.status(200).json({
      keys: [
        {
          kty: "oct",
          alg: "HS256",
          use: "sig",
          status: "active",
          note: "Symmetric HMAC-SHA256 signature strategy for MVP-03",
        },
      ],
    });
  };
}

module.exports = TokenController;
