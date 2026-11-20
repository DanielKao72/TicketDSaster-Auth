const { Router } = require('express');

// Mounted once at the root, so every route declares its full path.
class AuthRoutes {
  /**
   * @param {object} deps
   * @param {import('../../../adapters/controllers/RegisterController')} deps.registerController
   * @param {import('../../../adapters/controllers/LoginController')} deps.loginController
   * @param {import('../../../adapters/controllers/TokenController')} deps.tokenController
   * @param {import('../middlewares/FailedAttemptLimiter')} deps.loginLimiter
   */
  constructor({ registerController, loginController, tokenController, loginLimiter }) {
    this.registerController = registerController;
    this.loginController = loginController;
    this.tokenController = tokenController;
    this.loginLimiter = loginLimiter;
  }

  build() {
    const router = Router();

    // Partner registration and login (PA-02..PA-07). Failed logins are
    // rate limited per client IP against password guessing.
    router.post('/auth/register', this.registerController.handle);
    router.post('/auth/login', this.loginLimiter.handle, this.loginController.handle);

    // Downstream JWT verification contract (PA-08-T2)
    router.post('/auth/validate', this.tokenController.validate);
    router.get('/.well-known/jwks.json', this.tokenController.jwks);

    return router;
  }
}

module.exports = AuthRoutes;
