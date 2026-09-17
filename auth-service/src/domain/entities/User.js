const DomainError = require('../errors/DomainError');
const { ROLE_VALUES } = require('../roles');

class User {
  constructor({ id, username, role, createdAt }) {
    if (!id) {
      throw new DomainError('User requires an id');
    }
    if (!username) {
      throw new DomainError('User requires a username');
    }
    if (!ROLE_VALUES.includes(role)) {
      throw new DomainError(`Invalid role: ${role}`);
    }

    this.id = id;
    this.username = username;
    this.role = role;
    this.createdAt = createdAt ?? new Date();
  }
}

module.exports = User;
