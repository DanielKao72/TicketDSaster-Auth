const fs = require('node:fs/promises');
const path = require('node:path');

// Applies the .sql files in migrations/ in name order, each one in its own
// transaction, and records them in schema_migrations so they run only once.
class Migrator {
  static MIGRATIONS_DIR = path.join(__dirname, 'migrations');

  // Arbitrary key for pg_advisory_lock: several replicas (or parallel test
  // files) may start at once, and only one of them may migrate at a time.
  static LOCK_KEY = 4_000_001;

  /** @param {{ pool: import('pg').Pool, migrationsDir?: string }} deps */
  constructor({ pool, migrationsDir = Migrator.MIGRATIONS_DIR }) {
    this.pool = pool;
    this.migrationsDir = migrationsDir;
  }

  /** @returns {Promise<string[]>} the names of the migrations applied now */
  async migrate() {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [Migrator.LOCK_KEY]);
      return await this.applyPending(client);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [Migrator.LOCK_KEY]).catch(() => {});
      client.release();
    }
  }

  async applyPending(client) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));

    const files = (await fs.readdir(this.migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    const pending = files.filter((file) => !applied.has(file));

    for (const file of pending) {
      const sql = await fs.readFile(path.join(this.migrationsDir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }
    }

    return pending;
  }
}

// `npm run migrate`: applies pending migrations without starting the server.
if (require.main === module) {
  const config = require('../config/Env');
  const PostgresConnection = require('./PostgresConnection');

  (async () => {
    const connection = new PostgresConnection(config.database);
    try {
      const applied = await new Migrator({ pool: connection.pool }).migrate();
      console.log(`[migrate] applied ${applied.length} migration(s)${applied.length ? `: ${applied.join(', ')}` : ''}`);
    } catch (error) {
      console.error(`[migrate] ${error.message}`);
      process.exitCode = 1;
    } finally {
      await connection.close();
    }
  })();
}

module.exports = Migrator;
