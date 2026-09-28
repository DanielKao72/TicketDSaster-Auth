const DomainError = require('../../../domain/errors/DomainError');

// Centralized error handling (docs/contributing/code-standards.md): controllers
// forward with next(error) instead of mapping every failure inline.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error instanceof DomainError) {
    return res.status(400).json({ error: error.message });
  }

  console.error('[auth-service] unexpected error:', error);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = errorHandler;
