const { createClient } = require('redis');

// Owns the Redis client used by RedisInvitationExpirationStore.
class RedisConnection {
  /** @param {{ url: string }} redisConfig */
  constructor({ url }) {
    this.client = createClient({ url });
    // node-redis reconnects on its own; without a listener a dropped
    // connection would crash the process instead.
    this.client.on('error', (error) => {
      console.error(`[auth-service] redis error: ${error.message}`);
    });
  }

  async connect() {
    await this.client.connect();
  }

  async close() {
    await this.client.close();
  }
}

module.exports = RedisConnection;
