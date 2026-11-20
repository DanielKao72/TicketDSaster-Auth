const Invitation = require('../../core/domain/entities/Invitation');
const InvalidInvitationError = require('../../core/use-cases/errors/InvalidInvitationError');
const { InvitationRepository } = require('../../ports/interfaces');

function toInvitation(row) {
  return new Invitation({
    code: row.code,
    role: row.role,
    used: row.used,
    usedAt: row.used_at,
    createdAt: row.created_at,
  });
}

// Postgres store for invitations (PA-01, PA-03), keyed by code. Only whether
// a code was used is stored here; its time window lives in Redis.
class PostgresInvitationRepository extends InvitationRepository {
  /** @param {{ db: { query: Function } }} deps */
  constructor({ db }) {
    super();
    this.db = db;
  }

  // Idempotent by code like the in-memory store. The conditional update never
  // overwrites a consumed row: if two registrations race for the same code,
  // the second one updates nothing and its transaction is rolled back.
  async save(invitation) {
    const { rowCount } = await this.db.query(
      `INSERT INTO invitations (code, role, used, used_at, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET used = EXCLUDED.used, used_at = EXCLUDED.used_at
       WHERE invitations.used = false`,
      [invitation.code, invitation.role, invitation.used, invitation.usedAt, invitation.createdAt],
    );
    if (rowCount === 0) {
      throw new InvalidInvitationError('Invitation code has already been used');
    }
    return invitation;
  }

  async existsByCode(code) {
    const { rowCount } = await this.db.query('SELECT 1 FROM invitations WHERE code = $1', [code]);
    return rowCount > 0;
  }

  async findByCode(code) {
    const { rows } = await this.db.query(
      'SELECT code, role, used, used_at, created_at FROM invitations WHERE code = $1',
      [code],
    );
    return rows[0] ? toInvitation(rows[0]) : null;
  }
}

module.exports = PostgresInvitationRepository;
