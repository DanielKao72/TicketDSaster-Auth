const { InvitationRepository } = require('../../ports/interfaces');

// Resilience decorator for InvitationRepository (see ResilientUserRepository).
// save is not retried: if the first attempt committed but its answer was lost,
// a retry would find the code consumed and report it as already used.
class ResilientInvitationRepository extends InvitationRepository {
  /** @param {{ inner: InvitationRepository, policy: { execute: Function } }} deps */
  constructor({ inner, policy }) {
    super();
    this.inner = inner;
    this.policy = policy;
  }

  async save(invitation) {
    return this.policy.execute(() => this.inner.save(invitation), { idempotent: false });
  }

  async existsByCode(code) {
    return this.policy.execute(() => this.inner.existsByCode(code));
  }

  async findByCode(code) {
    return this.policy.execute(() => this.inner.findByCode(code));
  }
}

module.exports = ResilientInvitationRepository;
