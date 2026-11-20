const express = require('express');

// PA-01-T1: registers POST /invitations.
// PA-01-T2: the staff credential guard sits in front of the handler, so an
// unauthorized caller is rejected before anything else runs. It is attached to
// the route and not to the router, which keeps unrouted methods on a plain 404.
//
// express.json() is mounted here, behind the guard, instead of globally: a
// caller without a staff credential gets a 401 even when it sends a malformed
// body, and the server does not parse bodies for requests it will reject.
//
// The failed-attempt limiter goes first, so guessing the staff credential is
// rate limited too: a blocked client gets a 429 before the guard runs.
class InvitationsRoutes {
  /**
   * @param {object} deps
   * @param {import('../../../adapters/controllers/InvitationsController')} deps.invitationsController
   * @param {import('../middlewares/StaffCredentialGuard')} deps.staffCredentialGuard
   * @param {import('../middlewares/FailedAttemptLimiter')} deps.invitationsLimiter
   */
  constructor({ invitationsController, staffCredentialGuard, invitationsLimiter }) {
    this.invitationsController = invitationsController;
    this.staffCredentialGuard = staffCredentialGuard;
    this.invitationsLimiter = invitationsLimiter;
  }

  build() {
    const router = express.Router();

    /**
     * @openapi
     * /invitations:
     *   post:
     *     tags: [Staff]
     *     summary: Generate a single-use invitation code
     *     description: >
     *       PA-01. Staff only (HTTP Basic Auth with the staff credential). The
     *       code is valid for INVITATION_TTL_SECONDS (5 minutes by default) and
     *       can be used once. Failed attempts, including wrong staff
     *       credentials, are rate limited per client IP.
     *     security:
     *       - staffBasicAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [role]
     *             properties:
     *               role: { $ref: '#/components/schemas/Role' }
     *     responses:
     *       201:
     *         description: Invitation created
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 code: { type: string, example: QDAK-EB4S-NXMN }
     *                 role: { $ref: '#/components/schemas/Role' }
     *                 createdAt: { type: string, format: date-time }
     *       400:
     *         description: Malformed JSON or a missing or invalid role.
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/Error' }
     *       401:
     *         description: Missing or wrong staff credential. Sent before the body is parsed.
     *         headers:
     *           WWW-Authenticate:
     *             schema: { type: string, example: 'Basic realm="D-Saster Staff", charset="UTF-8"' }
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/Error' }
     *       429: { $ref: '#/components/responses/TooManyFailedAttempts' }
     *       503: { $ref: '#/components/responses/ServiceUnavailable' }
     */
    router.post(
      '/',
      this.invitationsLimiter.handle,
      this.staffCredentialGuard.handle,
      express.json(),
      this.invitationsController.generate,
    );

    return router;
  }
}

module.exports = InvitationsRoutes;
