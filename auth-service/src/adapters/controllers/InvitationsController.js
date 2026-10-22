const { ROLE_VALUES } = require('../../core/domain/Roles');

// PA-01-T1: programmatic invitation generation. This is a programmatic API
// only; no screen is served for it (MVP 03, PA-01.3).
class InvitationsController {
  /** @param {{ generateInvitation: import('../../core/use-cases/GenerateInvitation') }} deps */
  constructor({ generateInvitation }) {
    this.generateInvitation = generateInvitation;
  }

  // POST /invitations
  generate = async (req, res, next) => {
    const { role } = req.body ?? {};

    // PA-01.1: the request must specify the role, VENUE_OWNER or ORGANIZER.
    if (!ROLE_VALUES.includes(role)) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: { role: `role is required and must be one of: ${ROLE_VALUES.join(', ')}` },
      });
    }

    // Generation and persistence belong to the use case; the controller only
    // translates HTTP in and out. Unexpected errors go to the centralized
    // error handler through next().
    try {
      const invitation = await this.generateInvitation.execute({ role });

      return res.status(201).json({
        code: invitation.code,
        role: invitation.role,
        createdAt: invitation.createdAt.toISOString(),
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = InvitationsController;
