const { Router } = require('express');

// Mounted once at the root, so every route declares its full path.
class AuthRoutes {
  /**
   * @param {object} deps
   * @param {import('../../../adapters/controllers/RegisterController')} deps.registerController
   * @param {import('../../../adapters/controllers/LoginController')} deps.loginController
   * @param {import('../../../adapters/controllers/TokenController')} deps.tokenController
   */
  constructor({ registerController, loginController, tokenController }) {
    this.registerController = registerController;
    this.loginController = loginController;
    this.tokenController = tokenController;
  }

  build() {
    const router = Router();

    // Partner registration and login (PA-02..PA-07)
    router.post('/auth/register', this.registerController.handle);
    router.post('/auth/login', this.loginController.handle);

    // Downstream JWT verification contract (PA-08-T2)
    router.post('/auth/validate', this.tokenController.validate);
    router.get('/.well-known/jwks.json', this.tokenController.jwks);

    return router;
  }
}

module.exports = AuthRoutes;
