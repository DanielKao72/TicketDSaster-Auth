const DomainError = require('../errors/DomainError');

// Stores the already-computed hash, never the plaintext password (PA-06).
// Hashing (bcrypt) is the responsibility of infrastructure/security, not domain/.
class Credential {
  constructor({ userId, passwordHash }) {
    if (!userId) {
      throw new DomainError('Credential requires a userId');
    }
    if (!passwordHash) {
      throw new DomainError('Credential requires a passwordHash');
    }

    this.userId = userId;
    this.passwordHash = passwordHash;
  }
}

module.exports = Credential;
