// Bearer JWT guard for routes that need an authenticated partner. Not mounted
// on any route yet; kept ready for role-protected endpoints.
class JwtAuthenticator {
  /** @param {{ tokenService: import('../../../ports/interfaces').TokenService }} deps */
  constructor({ tokenService }) {
    this.tokenService = tokenService;
  }

  handle = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = this.tokenService.verify(token);
      req.user = {
        id: decoded.sub,
        role: decoded.role,
      };
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

module.exports = JwtAuthenticator;
