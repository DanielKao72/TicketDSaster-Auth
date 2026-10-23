const { createClient } = require('redis');

// Owns the Redis client used by RedisInvitationExpirationStore.
class RedisConnection {
  /** @param {{ url: string, timeoutMs?: number }} redisConfig */
  constructor({ url, timeoutMs }) {
    // Without the offline queue a command fails at once while Redis is down,
    // instead of waiting for a reconnection, so the circuit breaker sees it.
    this.client = createClient({
      url,
      disableOfflineQueue: true,
      ...(timeoutMs && { socket: { connectTimeout: timeoutMs } }),
    });
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
