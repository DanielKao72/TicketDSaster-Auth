const express = require('express');
const createAuthRoutes = require('./infrastructure/http/routes/auth.routes');

function createApp({ userRepository, credentialRepository, invitationRepository } = {}) {
  const app = express();

  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use(createAuthRoutes({ userRepository, credentialRepository, invitationRepository }));
  
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  return app;
}

module.exports = createApp;