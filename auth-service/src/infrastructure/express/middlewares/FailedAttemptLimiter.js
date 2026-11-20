const { rateLimit } = require('express-rate-limit');

// Brute-force protection for the credential endpoints (POST /auth/login and
// POST /invitations). Only rejected credentials count (401 responses): a
// client that logs in successfully, or sends an invalid body (400), is never
// pushed towards the limit. Once a client IP reaches `maxFailedAttempts`
// within `windowMs`, the route answers 429 until the window resets.
//
// The counters live in memory, so the limit applies per replica. Each
// instance has its own store, so every protected route counts separately.
// Behind a reverse proxy, set TRUST_PROXY so the client IP is the real one.
class FailedAttemptLimiter {
  /** @param {{ windowMs: number, maxFailedAttempts: number }} options */
  constructor({ windowMs, maxFailedAttempts }) {
    this.handle = rateLimit({
      windowMs,
      limit: maxFailedAttempts,
      skipSuccessfulRequests: true,
      requestWasSuccessful: (req, res) => res.statusCode !== 401,
      standardHeaders: 'draft-6',
      legacyHeaders: false,
      handler: (req, res, next, options) => {
        res.set('Retry-After', String(Math.ceil(options.windowMs / 1000)));
        res.status(429).json({ error: 'Too many failed attempts, try again later' });
      },
    });
  }
}

module.exports = FailedAttemptLimiter;
