require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function resiliencePolicyConfig(timeoutMs) {
  return {
    timeoutMs,
    retry: {
      maxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS || 2), // retries after the first call
      initialDelayMs: Number(process.env.RETRY_INITIAL_DELAY_MS || 100),
      maxDelayMs: Number(process.env.RETRY_MAX_DELAY_MS || 1000),
    },
    breaker: {
      consecutiveFailures: Number(process.env.CIRCUIT_BREAKER_THRESHOLD || 5),
      halfOpenAfterMs: Number(process.env.CIRCUIT_BREAKER_HALF_OPEN_AFTER_MS || 10000),
    },
  };
}

function parseTrustProxy(value) {
  if (value === undefined || value === '' || value === 'false') {
    return false;
  }
  if (value === 'true') {
    return true;
  }
  return /^\d+$/.test(value) ? Number(value) : value;
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

  // Brute-force protection for POST /auth/login and POST /invitations: after
  // this many failed attempts from one client IP within the window, the route
  // answers 429 until the window resets. Counted in memory, per replica.
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000), // 15 min
    maxFailedAttempts: Number(process.env.RATE_LIMIT_MAX_FAILED || 10),
  },

  // Express 'trust proxy': set it when the service runs behind a reverse
  // proxy, so the rate limit keys on the client IP and not the proxy's.
  // 'true' / 'false', a hop count ('1') or a subnet list ('loopback, 10.0.0.0/8').
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

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

  // Fallback(CircuitBreaker(Retry(Timeout(call)))) around every Postgres and
  // Redis call (infrastructure/resilience/ResiliencePolicy.js). Retry and
  // circuit breaker settings are shared; only the timeout differs per store.
  resilience: {
    postgres: resiliencePolicyConfig(Number(process.env.PG_TIMEOUT_MS || 2000)),
    redis: resiliencePolicyConfig(Number(process.env.REDIS_TIMEOUT_MS || 500)),
  },

  // Tests against a real Postgres and Redis are skipped unless this is set.
  integrationTests: process.env.RUN_INTEGRATION_TESTS === 'true',
};
