const { Router } = require('express');

const createInvitationsController = require('../controllers/invitations.controller');

// PA-01-T1: registers POST /invitations.
// PA-01-T2 (separate task) adds the staff credential guard in front of the
// handler, e.g. router.post('/', requireStaffCredential, controller.generate).
function createInvitationsRouter({ generateInvitation }) {
  const router = Router();
  const invitationsController = createInvitationsController({ generateInvitation });

  router.post('/', invitationsController.generate);

  return router;
}

module.exports = createInvitationsRouter;
