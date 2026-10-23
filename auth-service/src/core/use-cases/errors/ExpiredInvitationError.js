const InvalidInvitationError = require('./InvalidInvitationError');

// PA-03: the invitation code exists and is unused, but its time window passed.
// It is an InvalidInvitationError, so callers that reject invalid codes also
// reject expired ones.
class ExpiredInvitationError extends InvalidInvitationError {
  constructor(message = 'Invitation code has expired') {
    super(message);
    this.name = 'ExpiredInvitationError';
  }
}

module.exports = ExpiredInvitationError;
