const { Pool } = require('pg');

// Owns the Postgres connection pool shared by every Postgres adapter.
class PostgresConnection {
  /** @param {{ url: string }} databaseConfig */
  constructor({ url }) {
    this.pool = new Pool({ connectionString: url });
  }

  // Fails fast at startup instead of on the first request.
  async verify() {
    await this.pool.query('SELECT 1');
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = PostgresConnection;
