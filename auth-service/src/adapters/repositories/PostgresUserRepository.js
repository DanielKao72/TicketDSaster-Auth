const User = require('../../core/domain/entities/User');
const UserAlreadyExistsError = require('../../core/use-cases/errors/UserAlreadyExistsError');
const { UserRepository } = require('../../ports/interfaces');

const UNIQUE_VIOLATION = '23505';

function toUser(row) {
  return new User({ id: row.id, username: row.username, role: row.role, createdAt: row.created_at });
}

// Postgres store for users. `db` is either the pool or a transaction client
// (see PostgresUnitOfWork). The password_hash column of the same table belongs
// to PostgresCredentialRepository and is never selected here.
class PostgresUserRepository extends UserRepository {
  /** @param {{ db: { query: Function } }} deps */
  constructor({ db }) {
    super();
    this.db = db;
  }

  async create({ username, role }) {
    try {
      const { rows } = await this.db.query(
        'INSERT INTO users (username, role) VALUES ($1, $2) RETURNING id, username, role, created_at',
        [username, role],
      );
      return toUser(rows[0]);
    } catch (error) {
      // PA-05: two concurrent registrations can both pass findByUsername();
      // the unique constraint decides which one wins.
      if (error.code === UNIQUE_VIOLATION) {
        throw new UserAlreadyExistsError(username);
      }
      throw error;
    }
  }

  async findById(id) {
    const { rows } = await this.db.query(
      'SELECT id, username, role, created_at FROM users WHERE id = $1',
      [id],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByUsername(username) {
    const { rows } = await this.db.query(
      'SELECT id, username, role, created_at FROM users WHERE username = $1',
      [username],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }
}

module.exports = PostgresUserRepository;
