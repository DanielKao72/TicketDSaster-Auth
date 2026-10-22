const InvalidCredentialsError = require('../../core/use-cases/errors/InvalidCredentialsError');

// POST /auth/login (PA-07): authenticates through LoginPartner and issues the JWT.
class LoginController {
  /**
   * @param {object} deps
   * @param {import('../../core/use-cases/LoginPartner')} deps.loginPartner
   * @param {import('../../ports/interfaces').TokenService} deps.tokenService
   * @param {number} deps.expiresInSeconds
   */
  constructor({ loginPartner, tokenService, expiresInSeconds }) {
    this.loginPartner = loginPartner;
    this.tokenService = tokenService;
    this.expiresInSeconds = expiresInSeconds;
  }

  handle = async (req, res, next) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'username and password must be strings' });
    }

    try {
      const user = await this.loginPartner.execute({ username, password });
      const accessToken = this.tokenService.generate({ userId: user.id, role: user.role });
      return res.status(200).json({
        accessToken,
        tokenType: 'Bearer',
        expiresIn: this.expiresInSeconds,
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return res.status(401).json({ error: err.message });
      }
      return next(err);
    }
  };
}

module.exports = LoginController;
