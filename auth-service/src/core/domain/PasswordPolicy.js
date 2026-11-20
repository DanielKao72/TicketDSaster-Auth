const DomainError = require('./errors/DomainError');

// PA-06: passwords shorter than 8 characters are rejected before hashing.
class PasswordPolicy {
  static MIN_PASSWORD_LENGTH = 8;

  static validate(plainPassword) {
    const { MIN_PASSWORD_LENGTH } = PasswordPolicy;

    if (typeof plainPassword !== 'string' || plainPassword.length < MIN_PASSWORD_LENGTH) {
      throw new DomainError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }
  }
}

module.exports = PasswordPolicy;
