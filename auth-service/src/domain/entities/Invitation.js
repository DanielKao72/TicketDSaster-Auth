const DomainError = require('../errors/DomainError');
const { ROLE_VALUES } = require('../roles');

class Invitation {
  constructor({ code, role, createdAt, used = false, usedAt = null }) {
    if (!code) {
      throw new DomainError('Invitation requires a code');
    }
    if (!ROLE_VALUES.includes(role)) {
      throw new DomainError(`Invalid role: ${role}`);
    }

    this.code = code;
    this.role = role;
    this.used = used;
    this.usedAt = usedAt;
    this.createdAt = createdAt ?? new Date();
  }

  // PA-03: the code is single-use; it is only consumed once the full
  // registration succeeds. Retrying an already-consumed code must fail.
  markUsed() {
    if (this.used) {
      throw new DomainError('Invitation code already used');
    }
    this.used = true;
    this.usedAt = new Date();
  }
}

module.exports = Invitation;
