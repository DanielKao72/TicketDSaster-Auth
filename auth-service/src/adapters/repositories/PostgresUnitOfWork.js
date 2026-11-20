const { UnitOfWork } = require('../../ports/interfaces');
const PostgresUserRepository = require('./PostgresUserRepository');
const PostgresCredentialRepository = require('./PostgresCredentialRepository');
const PostgresInvitationRepository = require('./PostgresInvitationRepository');

// Runs the work inside one Postgres transaction: the repositories it receives
// share a single client, and any error rolls every write back.
class PostgresUnitOfWork extends UnitOfWork {
  /** @param {{ pool: import('pg').Pool }} deps */
  constructor({ pool }) {
    super();
    this.pool = pool;
  }

  async run(work) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work({
        userRepository: new PostgresUserRepository({ db: client }),
        credentialRepository: new PostgresCredentialRepository({ db: client }),
        invitationRepository: new PostgresInvitationRepository({ db: client }),
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      // Keep the original error even if the rollback itself fails.
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PostgresUnitOfWork;
