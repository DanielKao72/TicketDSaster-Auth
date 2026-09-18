const { Router } = require("express");
const {
  validateTokenHandler,
  getJwksContractHandler,
} = require("../controllers/auth.controller");

function createAuthRoutes() {
  const router = Router();

  router.post("/validate", validateTokenHandler);
  router.get("/.well-known/jwks.json", getJwksContractHandler);

  return router;
}

module.exports = createAuthRoutes;
