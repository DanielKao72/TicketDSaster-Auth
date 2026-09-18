const { Router } = require('express');
const { makeLoginController } = require('../controllers/login.controller');

function createAuthRoutes({ userRepository, credentialRepository }) {
  const router = Router();
  router.post('/auth/login', makeLoginController({ userRepository, credentialRepository }));
  return router;
}

module.exports = createAuthRoutes;
