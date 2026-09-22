const express = require('express');

const createGenerateInvitation = require('./application/use-cases/generate-invitation');
const InMemoryInvitationRepository = require('./infrastructure/persistence/in-memory-invitation.repository');
const generateInvitationCode = require('./infrastructure/security/invitation-code');
const createInvitationsRouter = require('./infrastructure/http/routes/invitations.routes');
const errorHandler = require('./infrastructure/http/middlewares/error-handler');

// Composition root: adapters and use cases are wired here so the layers below
// stay free of framework and store details. Dependencies can be overridden,
// which is what the route tests use to get a clean store per run.
function createApp({ invitationRepository = new InMemoryInvitationRepository() } = {}) {
  const app = express();

  app.use(express.json());

  const generateInvitation = createGenerateInvitation({
    invitationRepository,
    generateInvitationCode,
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/invitations', createInvitationsRouter({ generateInvitation }));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
