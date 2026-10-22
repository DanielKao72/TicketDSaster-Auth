const bcrypt = require('bcrypt');

const { PasswordHasher } = require('../../ports/interfaces');

// Wraps bcrypt so the rest of the app never touches the library directly.
// PA-06: passwords are never stored in readable form — only this hash leaves this class.
class BcryptPasswordHasher extends PasswordHasher {
  static SALT_ROUNDS = 10;

  async hash(plainPassword) {
    return bcrypt.hash(plainPassword, BcryptPasswordHasher.SALT_ROUNDS);
  }

  async compare(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}

module.exports = BcryptPasswordHasher;
