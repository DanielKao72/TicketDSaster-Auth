const Credential = require('../../core/domain/entities/Credential');
const { CredentialRepository } = require('../../ports/interfaces');

// PA-06: the credential lives in the password_hash column of users (one per
// user), but stays a separate port so the hash never travels inside User.
class PostgresCredentialRepository extends CredentialRepository {
  /** @param {{ db: { query: Function } }} deps */
  constructor({ db }) {
    super();
    this.db = db;
  }

  async create({ userId, passwordHash }) {
    const credential = new Credential({ userId, passwordHash });
    const { rowCount } = await this.db.query(
      'UPDATE users SET password_hash = $2 WHERE id = $1',
      [credential.userId, credential.passwordHash],
    );
    if (rowCount === 0) {
      throw new Error(`Cannot store a credential for unknown user ${userId}`);
    }
    return credential;
  }

  async findByUserId(userId) {
    const { rows } = await this.db.query(
      'SELECT id, password_hash FROM users WHERE id = $1 AND password_hash IS NOT NULL',
      [userId],
    );
    return rows[0] ? new Credential({ userId: rows[0].id, passwordHash: rows[0].password_hash }) : null;
  }
}

module.exports = PostgresCredentialRepository;
