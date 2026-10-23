const Invitation = require('../domain/entities/Invitation');
const DomainError = require('../domain/errors/DomainError');
const { ROLE_VALUES } = require('../domain/Roles');

// PA-01: generates an invitation for a partner role (VENUE_OWNER or ORGANIZER)
// and persists it. Role validation also lives in the Invitation entity; it is
// repeated here so the use case fails before touching the store.
class GenerateInvitation {
  // PA-01.2: a collision is practically impossible, but the store — not the
  // generator — decides whether a code is free, so generation is retried a
  // bounded number of times instead of trusting the random source blindly.
  static MAX_CODE_ATTEMPTS = 5;

  /**
   * @param {object} deps
   * @param {import('../../ports/interfaces').InvitationRepository} deps.invitationRepository
   * @param {import('../../ports/interfaces').CodeGenerator} deps.codeGenerator
   * @param {import('../../ports/interfaces').InvitationExpirationStore} deps.invitationExpirationStore
   * @param {number} deps.invitationTtlSeconds
   */
  constructor({ invitationRepository, codeGenerator, invitationExpirationStore, invitationTtlSeconds }) {
    this.invitationRepository = invitationRepository;
    this.codeGenerator = codeGenerator;
    this.invitationExpirationStore = invitationExpirationStore;
    this.invitationTtlSeconds = invitationTtlSeconds;
  }

  async execute({ role }) {
    if (!ROLE_VALUES.includes(role)) {
      throw new DomainError(`Invalid role: ${role}`);
    }

    for (let attempt = 1; attempt <= GenerateInvitation.MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = this.codeGenerator.generate();

      if (!(await this.invitationRepository.existsByCode(code))) {
        const invitation = await this.invitationRepository.save(new Invitation({ code, role }));

        // PA-03: the code is only usable for a limited time. It is started
        // after the invitation is stored: if this step fails, the code simply
        // counts as expired and staff generates a new one.
        await this.invitationExpirationStore.markActive(code, this.invitationTtlSeconds);

        return invitation;
      }
    }

    throw new DomainError('Could not generate a unique invitation code');
  }
}

module.exports = GenerateInvitation;
