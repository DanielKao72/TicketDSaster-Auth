const Credential = require('../../domain/entities/Credential');

// SETUP-NJ-T2: in-memory mock store for credentials. Only the bcrypt hash is
// kept (PA-06); one credential per user.
class InMemoryCredentialRepository {
  constructor() {
    this.credentialsByUserId = new Map();
  }

  async create({ userId, passwordHash }) {
    const credential = new Credential({ userId, passwordHash });
    this.credentialsByUserId.set(credential.userId, credential);
    return credential;
  }

  async findByUserId(userId) {
    return this.credentialsByUserId.get(userId) ?? null;
  }
}

module.exports = InMemoryCredentialRepository;
