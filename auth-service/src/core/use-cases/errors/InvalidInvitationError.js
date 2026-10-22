// PA-03: the invitation code does not exist or was already consumed.
class InvalidInvitationError extends Error {
  constructor(message = 'Invalid or already consumed invitation code') {
    super(message);
    this.name = 'InvalidInvitationError';
  }
}

module.exports = InvalidInvitationError;
