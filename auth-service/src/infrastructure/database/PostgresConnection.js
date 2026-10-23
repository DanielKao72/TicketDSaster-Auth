const { Pool } = require('pg');

// Owns the Postgres connection pool shared by every Postgres adapter.
class PostgresConnection {
  /** @param {{ url: string, timeoutMs?: number }} databaseConfig */
  constructor({ url, timeoutMs }) {
    // With timeoutMs the driver enforces the timeout itself, so a slow
    // statement really fails (and a transaction rolls back) instead of being
    // merely abandoned by the resilience policy while it keeps running. The
    // migrator connects without it: waiting for the advisory lock while
    // another replica migrates can take longer than any request should.
    this.pool = new Pool({
      connectionString: url,
      ...(timeoutMs && { connectionTimeoutMillis: timeoutMs, query_timeout: timeoutMs }),
    });
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
