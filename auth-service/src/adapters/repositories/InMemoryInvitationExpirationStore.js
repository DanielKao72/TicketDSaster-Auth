const { InvitationExpirationStore } = require('../../ports/interfaces');

// In-memory counterpart of RedisInvitationExpirationStore (PA-03). The clock
// is injectable so tests can move past the expiration without waiting.
class InMemoryInvitationExpirationStore extends InvitationExpirationStore {
  constructor({ now = () => Date.now() } = {}) {
    super();
    this.now = now;
    this.expiresAtByCode = new Map();
  }

  async markActive(code, ttlSeconds) {
    this.expiresAtByCode.set(code, this.now() + ttlSeconds * 1000);
  }

  async isActive(code) {
    const expiresAt = this.expiresAtByCode.get(code);
    return expiresAt !== undefined && this.now() < expiresAt;
  }

  async revoke(code) {
    this.expiresAtByCode.delete(code);
  }
}

module.exports = InMemoryInvitationExpirationStore;
