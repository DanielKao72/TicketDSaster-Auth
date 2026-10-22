const express = require('express');

const createInvitationsController = require('../controllers/invitations.controller');

// PA-01-T1: registers POST /invitations.
// PA-01-T2: the staff credential guard sits in front of the handler, so an
// unauthorized caller is rejected before anything else runs. It is attached to
// the route and not to the router, which keeps unrouted methods on a plain 404.
//
// express.json() is mounted here, behind the guard, instead of globally: a
// caller without a staff credential gets a 401 even when it sends a malformed
// body, and the server does not parse bodies for requests it will reject.
function createInvitationsRouter({ generateInvitation, requireStaffCredential }) {
  const router = express.Router();
  const invitationsController = createInvitationsController({ generateInvitation });

  router.post('/', requireStaffCredential, express.json(), invitationsController.generate);

  return router;
}

module.exports = createInvitationsRouter;
