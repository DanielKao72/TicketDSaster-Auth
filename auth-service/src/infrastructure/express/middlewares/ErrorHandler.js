const DomainError = require('../../../core/domain/errors/DomainError');
const ServiceUnavailableError = require('../../../core/use-cases/errors/ServiceUnavailableError');

// Centralized error handling (docs/contributing/code-standards.md): controllers
// forward with next(error) instead of mapping every failure inline.
class ErrorHandler {
  // Express recognizes an error handler by its four parameters, so `next`
  // stays in the signature even though it is not called.
  // eslint-disable-next-line no-unused-vars
  handle = (error, req, res, next) => {
    // Raised by express.json() when the body is not valid JSON: a client error.
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Malformed JSON body' });
    }

    // A store is down or its circuit is open (infrastructure/resilience).
    if (error instanceof ServiceUnavailableError) {
      res.set('Retry-After', String(error.retryAfterSeconds));
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    if (error instanceof DomainError) {
      return res.status(400).json({ error: error.message });
    }

    console.error('[auth-service] unexpected error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  };
}

module.exports = ErrorHandler;
