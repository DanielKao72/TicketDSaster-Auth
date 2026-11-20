const { CredentialRepository } = require('../../ports/interfaces');

// Resilience decorator for CredentialRepository (see ResilientUserRepository).
class ResilientCredentialRepository extends CredentialRepository {
  /** @param {{ inner: CredentialRepository, policy: { execute: Function } }} deps */
  constructor({ inner, policy }) {
    super();
    this.inner = inner;
    this.policy = policy;
  }

  async create(data) {
    return this.policy.execute(() => this.inner.create(data), { idempotent: false });
  }

  async findByUserId(userId) {
    return this.policy.execute(() => this.inner.findByUserId(userId));
  }
}

module.exports = ResilientCredentialRepository;
