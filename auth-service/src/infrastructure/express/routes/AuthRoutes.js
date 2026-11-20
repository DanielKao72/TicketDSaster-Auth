const { Router } = require('express');

// Mounted once at the root, so every route declares its full path.
class AuthRoutes {
  /**
   * @param {object} deps
   * @param {import('../../../adapters/controllers/RegisterController')} deps.registerController
   * @param {import('../../../adapters/controllers/LoginController')} deps.loginController
   * @param {import('../../../adapters/controllers/TokenController')} deps.tokenController
   * @param {import('../middlewares/FailedAttemptLimiter')} deps.loginLimiter
   */
  constructor({ registerController, loginController, tokenController, loginLimiter }) {
    this.registerController = registerController;
    this.loginController = loginController;
    this.tokenController = tokenController;
    this.loginLimiter = loginLimiter;
  }

  build() {
    const router = Router();

    // Partner registration and login (PA-02..PA-07). Failed logins are
    // rate limited per client IP against password guessing.

    /**
     * @openapi
     * /auth/register:
     *   post:
     *     tags: [Partners]
     *     summary: Register a partner with an invitation code
     *     description: >
     *       PA-02..PA-06. The role comes from the invitation, not from the
     *       request. The code must exist, be unused and still be within its
     *       validity window (INVITATION_TTL_SECONDS); it is consumed only if
     *       registration fully succeeds.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [username, password, invitationCode]
     *             properties:
     *               username:
     *                 type: string
     *                 description: >
     *                   3-50 letters, digits, '.', '_' or '-'. Surrounding spaces
     *                   are ignored. Unique regardless of case.
     *                 pattern: '^[A-Za-z0-9._-]{3,50}$'
     *                 example: venue.owner_1
     *               password:
     *                 type: string
     *                 format: password
     *                 description: At least 8 characters, at most 72 bytes, with at least one letter and one digit.
     *                 example: Secret123!
     *               invitationCode:
     *                 type: string
     *                 example: QDAK-EB4S-NXMN
     *     responses:
     *       201:
     *         description: Partner registered
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 id: { type: string, format: uuid }
     *                 username: { type: string, example: venue.owner_1 }
     *                 role: { $ref: '#/components/schemas/Role' }
     *       400:
     *         description: >
     *           Missing or non-string fields, a username or password that breaks
     *           the policy, or an invitation code that does not exist, was
     *           already used or has expired.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/Error' }
     *             example: { error: Invitation code has expired }
     *       409:
     *         description: The username already exists (regardless of case).
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/Error' }
     *       503: { $ref: '#/components/responses/ServiceUnavailable' }
     */
    router.post('/auth/register', this.registerController.handle);

    /**
     * @openapi
     * /auth/login:
     *   post:
     *     tags: [Partners]
     *     summary: Log in and get a JWT
     *     description: >
     *       PA-07. The username is matched regardless of case. Failed attempts
     *       are rate limited per client IP.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [username, password]
     *             properties:
     *               username: { type: string, example: venue.owner_1 }
     *               password: { type: string, format: password, example: Secret123! }
     *     responses:
     *       200:
     *         description: Authenticated
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 accessToken:
     *                   type: string
     *                   description: HS256 JWT whose payload is only { sub, role, iat, exp }.
     *                 tokenType: { type: string, enum: [Bearer] }
     *                 expiresIn: { type: integer, description: Seconds, example: 28800 }
     *       400:
     *         description: Missing or non-string fields.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/Error' }
     *       401:
     *         description: Unknown username or wrong password (same message for both).
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/Error' }
     *             example: { error: Invalid username or password }
     *       429: { $ref: '#/components/responses/TooManyFailedAttempts' }
     *       503: { $ref: '#/components/responses/ServiceUnavailable' }
     */
    router.post('/auth/login', this.loginLimiter.handle, this.loginController.handle);

    // Downstream JWT verification contract (PA-08-T2)

    /**
     * @openapi
     * /auth/validate:
     *   post:
     *     tags: [Downstream contract]
     *     summary: Validate a JWT issued by this service
     *     description: >
     *       PA-08-T2. Send the token in the body or as a Bearer token. Only
     *       HS256 tokens with an `exp` claim are accepted. Stateless: it works
     *       even while Postgres or Redis are down.
     *     security:
     *       - {}
     *       - bearerAuth: []
     *     requestBody:
     *       required: false
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               token: { type: string }
     *     responses:
     *       200:
     *         description: Valid token
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 valid: { type: boolean, enum: [true] }
     *                 sub: { type: string, description: User id }
     *                 role: { $ref: '#/components/schemas/Role' }
     *                 iat: { type: integer }
     *                 exp: { type: integer }
     *       400:
     *         description: No token in the body or the Authorization header.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/Error' }
     *       401:
     *         description: Invalid signature, algorithm or claims, or an expired token.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 valid: { type: boolean, enum: [false] }
     *                 error: { type: string, enum: [Token expired, Invalid token signature] }
     */
    router.post('/auth/validate', this.tokenController.validate);

    /**
     * @openapi
     * /.well-known/jwks.json:
     *   get:
     *     tags: [Downstream contract]
     *     summary: Describe the JWT signature strategy
     *     description: >
     *       Tokens are signed with HMAC-SHA256 and the shared JWT_SECRET, so no
     *       key material is published; this only describes the active strategy.
     *     responses:
     *       200:
     *         description: Active signature strategy
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 keys:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       kty: { type: string, example: oct }
     *                       alg: { type: string, example: HS256 }
     *                       use: { type: string, example: sig }
     *                       status: { type: string, example: active }
     *                       note: { type: string }
     */
    router.get('/.well-known/jwks.json', this.tokenController.jwks);

    return router;
  }
}

module.exports = AuthRoutes;
