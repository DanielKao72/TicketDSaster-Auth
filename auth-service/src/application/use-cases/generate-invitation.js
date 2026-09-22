const Invitation = require('../../domain/entities/Invitation');
const DomainError = require('../../domain/errors/DomainError');
const { ROLE_VALUES } = require('../../domain/roles');

// PA-01.2: a collision is practically impossible, but the store — not the
// generator — decides whether a code is free, so generation is retried a
// bounded number of times instead of trusting the random source blindly.
const MAX_CODE_ATTEMPTS = 5;

// PA-01: generates an invitation for a partner role (VENUE_OWNER or ORGANIZER)
// and persists it. Role validation also lives in the Invitation entity; it is
// repeated here so the use case fails before touching the store.
function createGenerateInvitation({ invitationRepository, generateInvitationCode }) {
  return async function generateInvitation({ role }) {
    if (!ROLE_VALUES.includes(role)) {
      throw new DomainError(`Invalid role: ${role}`);
    }

    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = generateInvitationCode();

      // eslint-disable-next-line no-await-in-loop
      if (!(await invitationRepository.existsByCode(code))) {
        return invitationRepository.save(new Invitation({ code, role }));
      }
    }

    throw new DomainError('Could not generate a unique invitation code');
  };
}

module.exports = createGenerateInvitation;
module.exports.MAX_CODE_ATTEMPTS = MAX_CODE_ATTEMPTS;
