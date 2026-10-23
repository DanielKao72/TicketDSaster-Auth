const PostgresConnection = require('./database/PostgresConnection');
const Migrator = require('./database/Migrator');
const RedisConnection = require('./cache/RedisConnection');
const ResiliencePolicy = require('./resilience/ResiliencePolicy');
const PostgresUserRepository = require('../adapters/repositories/PostgresUserRepository');
const PostgresCredentialRepository = require('../adapters/repositories/PostgresCredentialRepository');
const PostgresInvitationRepository = require('../adapters/repositories/PostgresInvitationRepository');
const PostgresUnitOfWork = require('../adapters/repositories/PostgresUnitOfWork');
const RedisInvitationExpirationStore = require('../adapters/services/RedisInvitationExpirationStore');
const ResilientUserRepository = require('../adapters/resilience/ResilientUserRepository');
const ResilientCredentialRepository = require('../adapters/resilience/ResilientCredentialRepository');
const ResilientInvitationRepository = require('../adapters/resilience/ResilientInvitationRepository');
const ResilientUnitOfWork = require('../adapters/resilience/ResilientUnitOfWork');
const ResilientInvitationExpirationStore = require('../adapters/resilience/ResilientInvitationExpirationStore');

// Opens the real stores (Postgres for users and invitations, Redis for the
// invitation time window) and returns the adapters App expects. App itself
// keeps defaulting to the in-memory stores, which is what the tests use.
// Every real adapter is wrapped in a Resilient* decorator that runs its calls
// through the store's ResiliencePolicy: one policy, and so one circuit
// breaker, per store.
class Persistence {
  constructor({ postgres, redis, resilienceConfig }) {
    this.postgres = postgres;
    this.redis = redis;
    this.resilience = {
      postgres: new ResiliencePolicy({ name: 'postgres', ...resilienceConfig.postgres }),
      redis: new ResiliencePolicy({ name: 'redis', ...resilienceConfig.redis }),
    };

    const db = postgres.pool;
    const policy = this.resilience.postgres;
    this.dependencies = {
      userRepository: new ResilientUserRepository({ inner: new PostgresUserRepository({ db }), policy }),
      credentialRepository: new ResilientCredentialRepository({ inner: new PostgresCredentialRepository({ db }), policy }),
      invitationRepository: new ResilientInvitationRepository({ inner: new PostgresInvitationRepository({ db }), policy }),
      unitOfWork: new ResilientUnitOfWork({ inner: new PostgresUnitOfWork({ pool: db }), policy }),
      invitationExpirationStore: new ResilientInvitationExpirationStore({
        inner: new RedisInvitationExpirationStore({ redisClient: redis.client }),
        policy: this.resilience.redis,
      }),
      resilience: this.resilience,
    };
  }

  /**
   * @param {{
   *   database: { url: string },
   *   redis: { url: string },
   *   resilience: { postgres: { timeoutMs: number }, redis: { timeoutMs: number } },
   * }} config
   */
  static async connect(config) {
    const postgres = new PostgresConnection({ ...config.database, timeoutMs: config.resilience.postgres.timeoutMs });
    const redis = new RedisConnection({ ...config.redis, timeoutMs: config.resilience.redis.timeoutMs });

    try {
      await postgres.verify();
      await Persistence.migrate(config.database);
      await redis.connect();
    } catch (error) {
      await Promise.allSettled([postgres.close(), redis.close()]);
      throw error;
    }

    return new Persistence({ postgres, redis, resilienceConfig: config.resilience });
  }

  // Migrations run on their own short-lived pool without the request timeout
  // (see PostgresConnection).
  static async migrate(databaseConfig) {
    const connection = new PostgresConnection(databaseConfig);
    try {
      await new Migrator({ pool: connection.pool }).migrate();
    } finally {
      await connection.close();
    }
  }

  async close() {
    await Promise.allSettled([this.postgres.close(), this.redis.close()]);
  }
}

module.exports = Persistence;
