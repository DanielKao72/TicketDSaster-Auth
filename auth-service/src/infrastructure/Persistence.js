const PostgresConnection = require('./database/PostgresConnection');
const Migrator = require('./database/Migrator');
const RedisConnection = require('./cache/RedisConnection');
const PostgresUserRepository = require('../adapters/repositories/PostgresUserRepository');
const PostgresCredentialRepository = require('../adapters/repositories/PostgresCredentialRepository');
const PostgresInvitationRepository = require('../adapters/repositories/PostgresInvitationRepository');
const PostgresUnitOfWork = require('../adapters/repositories/PostgresUnitOfWork');
const RedisInvitationExpirationStore = require('../adapters/services/RedisInvitationExpirationStore');

// Opens the real stores (Postgres for users and invitations, Redis for the
// invitation time window) and returns the adapters App expects. App itself
// keeps defaulting to the in-memory stores, which is what the tests use.
class Persistence {
  constructor({ postgres, redis }) {
    this.postgres = postgres;
    this.redis = redis;

    const db = postgres.pool;
    this.dependencies = {
      userRepository: new PostgresUserRepository({ db }),
      credentialRepository: new PostgresCredentialRepository({ db }),
      invitationRepository: new PostgresInvitationRepository({ db }),
      unitOfWork: new PostgresUnitOfWork({ pool: db }),
      invitationExpirationStore: new RedisInvitationExpirationStore({ redisClient: redis.client }),
    };
  }

  /** @param {{ database: { url: string }, redis: { url: string } }} config */
  static async connect(config) {
    const postgres = new PostgresConnection(config.database);
    const redis = new RedisConnection(config.redis);

    try {
      await postgres.verify();
      await new Migrator({ pool: postgres.pool }).migrate();
      await redis.connect();
    } catch (error) {
      await Promise.allSettled([postgres.close(), redis.close()]);
      throw error;
    }

    return new Persistence({ postgres, redis });
  }

  async close() {
    await Promise.allSettled([this.postgres.close(), this.redis.close()]);
  }
}

module.exports = Persistence;
