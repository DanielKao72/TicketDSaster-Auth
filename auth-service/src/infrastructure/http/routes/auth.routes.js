const { Router } = require('express');
const { makeLoginController } = require('../controllers/login.controller');
const { makeRegisterController } = require('../controllers/register.controller');

function createAuthRoutes({ userRepository, credentialRepository, invitationRepository }) {
  const router = Router();
  router.post('/auth/login', makeLoginController({ userRepository, credentialRepository }));
  router.post('/auth/register', makeRegisterController({ userRepository, credentialRepository, invitationRepository }));
  return router;
}

module.exports = createAuthRoutes;
