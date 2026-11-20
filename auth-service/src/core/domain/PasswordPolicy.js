const DomainError = require('./errors/DomainError');

// PA-06: passwords are validated before hashing. They need at least 8
// characters with at least one letter and one digit, and at most 72 bytes:
// bcrypt ignores everything past byte 72, so a longer password would match
// any other one that shares its first 72 bytes.
class PasswordPolicy {
  static MIN_PASSWORD_LENGTH = 8;
  static MAX_PASSWORD_BYTES = 72;

  static validate(plainPassword) {
    const { MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES } = PasswordPolicy;

    if (typeof plainPassword !== 'string' || plainPassword.length < MIN_PASSWORD_LENGTH) {
      throw new DomainError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }
    if (Buffer.byteLength(plainPassword, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new DomainError(`Password must be at most ${MAX_PASSWORD_BYTES} bytes long`);
    }
    if (!/\p{L}/u.test(plainPassword) || !/\p{Nd}/u.test(plainPassword)) {
      throw new DomainError('Password must contain at least one letter and one digit');
    }
  }
}

module.exports = PasswordPolicy;
