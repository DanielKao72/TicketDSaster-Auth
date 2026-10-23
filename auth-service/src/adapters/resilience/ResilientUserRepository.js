const { UserRepository } = require('../../ports/interfaces');

// Runs every call of the wrapped UserRepository through the store's resilience
// policy (infrastructure/resilience/ResiliencePolicy.js). Reads are retried;
// create is not, because a retried INSERT could run twice.
class ResilientUserRepository extends UserRepository {
  /** @param {{ inner: UserRepository, policy: { execute: Function } }} deps */
  constructor({ inner, policy }) {
    super();
    this.inner = inner;
    this.policy = policy;
  }

  async create(data) {
    return this.policy.execute(() => this.inner.create(data), { idempotent: false });
  }

  async findById(id) {
    return this.policy.execute(() => this.inner.findById(id));
  }

  async findByUsername(username) {
    return this.policy.execute(() => this.inner.findByUsername(username));
  }
}

module.exports = ResilientUserRepository;
