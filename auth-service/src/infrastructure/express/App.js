const express = require('express');

const config = require('../config/Env');
const GenerateInvitation = require('../../core/use-cases/GenerateInvitation');
const RegisterPartner = require('../../core/use-cases/RegisterPartner');
const LoginPartner = require('../../core/use-cases/LoginPartner');
const InMemoryUserRepository = require('../../adapters/repositories/InMemoryUserRepository');
const InMemoryCredentialRepository = require('../../adapters/repositories/InMemoryCredentialRepository');
const InMemoryInvitationRepository = require('../../adapters/repositories/InMemoryInvitationRepository');
const InMemoryInvitationExpirationStore = require('../../adapters/repositories/InMemoryInvitationExpirationStore');
const InMemoryUnitOfWork = require('../../adapters/repositories/InMemoryUnitOfWork');
const BcryptPasswordHasher = require('../../adapters/services/BcryptPasswordHasher');
const JwtTokenService = require('../../adapters/services/JwtTokenService');
const InvitationCodeGenerator = require('../../adapters/services/InvitationCodeGenerator');
const RegisterController = require('../../adapters/controllers/RegisterController');
const LoginController = require('../../adapters/controllers/LoginController');
const TokenController = require('../../adapters/controllers/TokenController');
const InvitationsController = require('../../adapters/controllers/InvitationsController');
const StaffCredentialGuard = require('./middlewares/StaffCredentialGuard');
const ErrorHandler = require('./middlewares/ErrorHandler');
const AuthRoutes = require('./routes/AuthRoutes');
const InvitationsRoutes = require('./routes/InvitationsRoutes');

// Composition root: adapters and use cases are wired here so the layers below
// stay free of framework and store details. Dependencies can be overridden,
// which is what the route tests use to get a clean store per run and what
// src/index.js uses to plug in the Postgres and Redis adapters (Persistence).
class App {
  constructor({
    userRepository = new InMemoryUserRepository(),
    credentialRepository = new InMemoryCredentialRepository(),
    invitationRepository = new InMemoryInvitationRepository(),
    invitationExpirationStore = new InMemoryInvitationExpirationStore(),
    unitOfWork = new InMemoryUnitOfWork({ userRepository, credentialRepository, invitationRepository }),
    invitationTtlSeconds = config.invitation.ttlSeconds,
    passwordHasher = new BcryptPasswordHasher(),
    tokenService = new JwtTokenService(config.jwt),
    codeGenerator = new InvitationCodeGenerator(),
    staffCredentials = config.staff,
    // ResiliencePolicy per store ({ postgres, redis }), from Persistence. Only
    // read by /health; the in-memory stores used by the tests need none.
    resilience = {},
  } = {}) {
    this.resilience = resilience;

    // The same invitationRepository and invitationExpirationStore back
    // generation (PA-01) and registration (PA-03), so a generated code can be
    // consumed by /auth/register while it has not expired.
    const generateInvitation = new GenerateInvitation({
      invitationRepository,
      codeGenerator,
      invitationExpirationStore,
      invitationTtlSeconds,
    });
    const registerPartner = new RegisterPartner({
      userRepository,
      credentialRepository,
      invitationRepository,
      passwordHasher,
      invitationExpirationStore,
      unitOfWork,
    });
    const loginPartner = new LoginPartner({ userRepository, credentialRepository, passwordHasher });

    // PA-01-T2: only staff can generate invitations. The guard is built from the
    // configured staff credential and enforced inside the invitations router.
    this.invitationsRoutes = new InvitationsRoutes({
      invitationsController: new InvitationsController({ generateInvitation }),
      staffCredentialGuard: new StaffCredentialGuard(staffCredentials),
    });

    this.authRoutes = new AuthRoutes({
      registerController: new RegisterController({ registerPartner }),
      loginController: new LoginController({
        loginPartner,
        tokenService,
        expiresInSeconds: config.jwt.expiresInSeconds,
      }),
      tokenController: new TokenController({ tokenService }),
    });

    this.errorHandler = new ErrorHandler();
  }

  // Returns the Express application. Keep the middleware order: routes, then
  // the 404 handler, then the error handler.
  build() {
    const app = express();

    /**
     * @openapi
     * /health:
     *   get:
     *     summary: Health check
     *     description: >
     *       Always 200 while the process is up (it backs the Docker HEALTHCHECK).
     *       `dependencies` shows the circuit breaker state of each store; the
     *       status is `degraded` while any of them is not closed.
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
     *                   enum: [ok, degraded]
     *                   example: ok
     *                 dependencies:
     *                   type: object
     *                   additionalProperties:
     *                     type: string
     *                     enum: [closed, open, half-open]
     *                   example: { postgres: closed, redis: closed }
     */
    app.get('/health', (req, res) => {
      const entries = Object.entries(this.resilience);
      if (entries.length === 0) {
        return res.status(200).json({ status: 'ok' });
      }

      const dependencies = Object.fromEntries(entries.map(([name, policy]) => [name, policy.state]));
      const degraded = Object.values(dependencies).some((state) => state !== 'closed');
      return res.status(200).json({ status: degraded ? 'degraded' : 'ok', dependencies });
    });

    // Mounted before the global JSON parser on purpose: the invitations router
    // parses its own body once the staff guard has let the request through.
    app.use('/invitations', this.invitationsRoutes.build());

    app.use(express.json());

    app.use(this.authRoutes.build());

    app.use((req, res) => res.status(404).json({ error: 'Not found' }));

    app.use(this.errorHandler.handle);

    return app;
  }
}

module.exports = App;
