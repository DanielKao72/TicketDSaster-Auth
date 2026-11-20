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
