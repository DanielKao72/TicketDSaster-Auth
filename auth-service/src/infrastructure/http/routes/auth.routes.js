const { Router } = require('express');
const { makeLoginController } = require('../controllers/login.controller');
const { makeRegisterController } = require('../controllers/register.controller');
const {
  validateTokenHandler,
  getJwksContractHandler,
} = require('../controllers/auth.controller');

// Mounted once at the root, so every route declares its full path.
function createAuthRoutes({ userRepository, credentialRepository, invitationRepository }) {
  const router = Router();

  // Partner registration and login (PA-02..PA-07)
  router.post('/auth/register', makeRegisterController({ userRepository, credentialRepository, invitationRepository }));
  router.post('/auth/login', makeLoginController({ userRepository, credentialRepository }));

  // Downstream JWT verification contract (PA-08-T2)
  router.post('/auth/validate', validateTokenHandler);
  router.get('/.well-known/jwks.json', getJwksContractHandler);

  return router;
}

module.exports = createAuthRoutes;
