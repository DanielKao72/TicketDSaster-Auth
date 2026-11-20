const { UnitOfWork } = require('../../ports/interfaces');

// Resilience decorator for UnitOfWork. A transaction is never retried, and it
// is not abandoned by the policy timeout either: the caller could get a 503
// while the transaction still commits. Its time limit is the driver's own
// query timeout (PostgresConnection), which fails the statement and lets the
// unit of work roll back. The circuit breaker and the 503 fallback still apply.
class ResilientUnitOfWork extends UnitOfWork {
  /** @param {{ inner: UnitOfWork, policy: { execute: Function } }} deps */
  constructor({ inner, policy }) {
    super();
    this.inner = inner;
    this.policy = policy;
  }

  async run(work) {
    return this.policy.execute(() => this.inner.run(work), { idempotent: false, timeout: false });
  }
}

module.exports = ResilientUnitOfWork;
