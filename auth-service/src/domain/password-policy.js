const DomainError = require('./errors/DomainError');

const MIN_PASSWORD_LENGTH = 8;

// PA-06: passwords shorter than 8 characters are rejected before hashing.
function validatePasswordPolicy(plainPassword) {
  if (!plainPassword || plainPassword.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
}

module.exports = { validatePasswordPolicy, MIN_PASSWORD_LENGTH };