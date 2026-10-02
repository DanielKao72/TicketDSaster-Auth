const { randomUUID } = require('node:crypto');

const User = require('../../domain/entities/User');

// SETUP-NJ-T2: in-memory mock store for users, same contract as the future
// persistent adapter. Usernames are unique (PA-05); registerPartner checks
// findByUsername() before calling create().
class InMemoryUserRepository {
  constructor() {
    this.usersById = new Map();
  }

  async create({ username, role }) {
    const user = new User({ id: randomUUID(), username, role });
    this.usersById.set(user.id, user);
    return user;
  }

  async findById(id) {
    return this.usersById.get(id) ?? null;
  }

  async findByUsername(username) {
    for (const user of this.usersById.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }
}

module.exports = InMemoryUserRepository;
