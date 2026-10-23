require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: required('JWT_SECRET'),
    expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 28800), // 8h
  },

  staff: {
    username: required('STAFF_USERNAME'),
    password: required('STAFF_PASSWORD'),
  },

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),

  // Optional on purpose: unit and route tests run on the in-memory stores, so
  // only src/index.js (through Persistence) connects to these.
  database: {
    url: process.env.DATABASE_URL || 'postgres://auth:auth@localhost:55432/auth',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6380',
  },

  // PA-03: an invitation code is only usable for this long after generation.
  invitation: {
    ttlSeconds: Number(process.env.INVITATION_TTL_SECONDS || 300), // 5 min
  },

  // Tests against a real Postgres and Redis are skipped unless this is set.
  integrationTests: process.env.RUN_INTEGRATION_TESTS === 'true',
};
