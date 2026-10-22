/* eslint-disable no-unused-vars */
// Ports of the hexagon: the contracts the core depends on. Each one is an
// abstract class; adapters extend it and override every method. Calling a
// method an adapter did not override fails loudly instead of returning
// undefined. Parameters are unused here on purpose: they document the contract.

function notImplemented(port, method) {
  return new Error(`Not implemented: ${port}.${method}`);
}

/** Persistence port for User entities. Usernames are unique (PA-05). */
class UserRepository {
  /** @param {{ username: string, role: string }} data */
  async create(data) {
    throw notImplemented('UserRepository', 'create');
  }

  /** @param {string} id @returns {Promise<object | null>} */
  async findById(id) {
    throw notImplemented('UserRepository', 'findById');
  }

  /** @param {string} username @returns {Promise<object | null>} */
  async findByUsername(username) {
    throw notImplemented('UserRepository', 'findByUsername');
  }
}

/** Persistence port for Credential entities: one hashed credential per user (PA-06). */
class CredentialRepository {
  /** @param {{ userId: string, passwordHash: string }} data */
  async create(data) {
    throw notImplemented('CredentialRepository', 'create');
  }

  /** @param {string} userId @returns {Promise<object | null>} */
  async findByUserId(userId) {
    throw notImplemented('CredentialRepository', 'findByUserId');
  }
}

/** Persistence port for Invitation entities, keyed by their unique code (PA-01, PA-03). */
class InvitationRepository {
  /** Stores a new invitation or an existing one that changed (idempotent by code). */
  async save(invitation) {
    throw notImplemented('InvitationRepository', 'save');
  }

  /** @param {string} code @returns {Promise<boolean>} */
  async existsByCode(code) {
    throw notImplemented('InvitationRepository', 'existsByCode');
  }

  /** @param {string} code @returns {Promise<object | null>} */
  async findByCode(code) {
    throw notImplemented('InvitationRepository', 'findByCode');
  }
}

/** One-way password hashing (PA-06): the plaintext never leaves this port. */
class PasswordHasher {
  /** @param {string} plainPassword @returns {Promise<string>} */
  async hash(plainPassword) {
    throw notImplemented('PasswordHasher', 'hash');
  }

  /** @param {string} plainPassword @param {string} passwordHash @returns {Promise<boolean>} */
  async compare(plainPassword, passwordHash) {
    throw notImplemented('PasswordHasher', 'compare');
  }
}

/** Issues and verifies the JWT that downstream services validate (PA-08). */
class TokenService {
  /** @param {{ userId: string, role: string }} claims @returns {string} */
  generate(claims) {
    throw notImplemented('TokenService', 'generate');
  }

  /** @param {string} token @returns {{ sub: string, role: string, iat: number, exp: number }} */
  verify(token) {
    throw notImplemented('TokenService', 'verify');
  }
}

/** Source of candidate invitation codes; the store decides uniqueness (PA-01.2). */
class CodeGenerator {
  /** @returns {string} */
  generate() {
    throw notImplemented('CodeGenerator', 'generate');
  }
}

module.exports = {
  UserRepository,
  CredentialRepository,
  InvitationRepository,
  PasswordHasher,
  TokenService,
  CodeGenerator,
};
