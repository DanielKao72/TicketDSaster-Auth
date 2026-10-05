const express = require('express');

const createGenerateInvitation = require('./application/use-cases/generate-invitation');
const InMemoryInvitationRepository = require('./infrastructure/persistence/in-memory-invitation.repository');
const InMemoryUserRepository = require('./infrastructure/persistence/in-memory-user.repository');
const InMemoryCredentialRepository = require('./infrastructure/persistence/in-memory-credential.repository');
const generateInvitationCode = require('./infrastructure/security/invitation-code');
const createInvitationsRouter = require('./infrastructure/http/routes/invitations.routes');
const createRequireStaffCredential = require('./infrastructure/http/middlewares/require-staff-credential');
const createAuthRoutes = require('./infrastructure/http/routes/auth.routes');
const errorHandler = require('./infrastructure/http/middlewares/error-handler');
const { staff } = require('./config/env');

// Composition root: adapters and use cases are wired here so the layers below
// stay free of framework and store details. Dependencies can be overridden,
// which is what the route tests use to get a clean store per run.
function createApp({
  userRepository = new InMemoryUserRepository(),
  credentialRepository = new InMemoryCredentialRepository(),
  invitationRepository = new InMemoryInvitationRepository(),
  staffCredentials = staff,
} = {}) {
  const app = express();

  // The same invitationRepository backs generation (PA-01) and registration
  // (PA-03), so a generated code can be consumed by /auth/register.
  const generateInvitation = createGenerateInvitation({
    invitationRepository,
    generateInvitationCode,
  });

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Health check
   *     responses:
   *       200:
   *         description: Service is up
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: ok
   */
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // PA-01-T2: only staff can generate invitations. The guard is built from the
  // configured staff credential and enforced inside the invitations router.
  const requireStaffCredential = createRequireStaffCredential(staffCredentials);

  // Mounted before the global JSON parser on purpose: the invitations router
  // parses its own body once the staff guard has let the request through.
  app.use('/invitations', createInvitationsRouter({ generateInvitation, requireStaffCredential }));

  app.use(express.json());

  app.use(createAuthRoutes({ userRepository, credentialRepository, invitationRepository }));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
