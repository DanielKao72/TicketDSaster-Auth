const express = require("express");
const createAuthRoutes = require("./infrastructure/http/routes/auth.routes");

function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Rutas de Auth y contrato downstream
  app.use("/auth", createAuthRoutes());
  app.use("/", createAuthRoutes()); // Expone /.well-known/jwks.json en la raíz

  app.use((req, res) => res.status(404).json({ error: "Not found" }));

  return app;
}

module.exports = createApp;
