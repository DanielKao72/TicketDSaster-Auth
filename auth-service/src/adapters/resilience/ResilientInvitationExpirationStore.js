const { InvitationExpirationStore } = require('../../ports/interfaces');

// Resilience decorator for InvitationExpirationStore (PA-03). Every command is
// idempotent (SET with TTL, EXISTS, DEL), so all of them are retried.
// - isActive / markActive fail closed: without Redis nobody can tell whether a
//   code is still within its window, so the request answers 503 instead of
//   accepting a code that might have expired.
// - revoke is best effort: the used flag in Postgres already blocks reuse and
//   the key expires on its own, so a failure is only logged.
class ResilientInvitationExpirationStore extends InvitationExpirationStore {
  /**
   * @param {object} deps
   * @param {InvitationExpirationStore} deps.inner
   * @param {{ execute: Function }} deps.policy
   * @param {{ warn: Function }} [deps.logger]
   */
  constructor({ inner, policy, logger = console }) {
    super();
    this.inner = inner;
    this.policy = policy;
    this.logger = logger;
  }

  async markActive(code, ttlSeconds) {
    return this.policy.execute(() => this.inner.markActive(code, ttlSeconds));
  }

  async isActive(code) {
    return this.policy.execute(() => this.inner.isActive(code));
  }

  async revoke(code) {
    return this.policy.execute(() => this.inner.revoke(code), {
      fallback: () => {
        this.logger.warn('[auth-service] could not revoke an invitation code; its key will expire on its own');
      },
    });
  }
}

module.exports = ResilientInvitationExpirationStore;
