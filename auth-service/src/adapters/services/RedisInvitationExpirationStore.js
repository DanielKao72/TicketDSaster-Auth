const { InvitationExpirationStore } = require('../../ports/interfaces');

// PA-03: an invitation code is only usable while its Redis key exists. Redis
// deletes the key once the TTL passes, so expiration needs no cleanup job.
class RedisInvitationExpirationStore extends InvitationExpirationStore {
  static KEY_PREFIX = 'invitation:';

  /** @param {{ redisClient: import('redis').RedisClientType }} deps */
  constructor({ redisClient }) {
    super();
    this.redisClient = redisClient;
  }

  static key(code) {
    return `${RedisInvitationExpirationStore.KEY_PREFIX}${code}`;
  }

  async markActive(code, ttlSeconds) {
    await this.redisClient.set(RedisInvitationExpirationStore.key(code), '1', {
      expiration: { type: 'EX', value: ttlSeconds },
    });
  }

  async isActive(code) {
    return (await this.redisClient.exists(RedisInvitationExpirationStore.key(code))) === 1;
  }

  async revoke(code) {
    await this.redisClient.del(RedisInvitationExpirationStore.key(code));
  }
}

module.exports = RedisInvitationExpirationStore;
