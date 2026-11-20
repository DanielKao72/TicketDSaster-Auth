const { UnitOfWork } = require('../../ports/interfaces');

// In-memory counterpart of PostgresUnitOfWork: it hands the work the same
// in-memory stores. There is no rollback; Node runs the work on a single
// thread, which is enough for tests and local runs without a database.
class InMemoryUnitOfWork extends UnitOfWork {
  constructor({ userRepository, credentialRepository, invitationRepository }) {
    super();
    this.repositories = { userRepository, credentialRepository, invitationRepository };
  }

  async run(work) {
    return work(this.repositories);
  }
}

module.exports = InMemoryUnitOfWork;
