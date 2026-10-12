// SETUP-NJ-T2: in-memory mock store for invitations; the persistent database is
// deferred to a later release. Node serves requests on a single thread, so the
// Map operations below are already atomic for the MVP. Replacing this adapter
// with a real one only requires keeping these method signatures.
class InMemoryInvitationRepository {
  constructor() {
    this.invitationsByCode = new Map();
  }

  // Stores a new invitation (PA-01) or an already existing one that changed,
  // e.g. after markUsed() during registration (PA-03), so it stays idempotent
  // by code. Uniqueness of freshly generated codes is checked with
  // existsByCode() before saving.
  async save(invitation) {
    this.invitationsByCode.set(invitation.code, invitation);
    return invitation;
  }

  async existsByCode(code) {
    return this.invitationsByCode.has(code);
  }

  async findByCode(code) {
    return this.invitationsByCode.get(code) ?? null;
  }
}

module.exports = InMemoryInvitationRepository;
