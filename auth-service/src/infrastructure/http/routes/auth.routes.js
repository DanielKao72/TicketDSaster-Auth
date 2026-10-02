const { Router } = require('express');
const { makeLoginController } = require('../controllers/login.controller');

function createAuthRoutes({ userRepository, credentialRepository }) {
  const router = Router();
  router.post('/auth/login', makeLoginController({ userRepository, credentialRepository }));
const { Router } = require("express");
const {
  validateTokenHandler,
  getJwksContractHandler,
} = require("../controllers/auth.controller");

function createAuthRoutes() {
  const router = Router();

  router.post("/validate", validateTokenHandler);
  router.get("/.well-known/jwks.json", getJwksContractHandler);

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
