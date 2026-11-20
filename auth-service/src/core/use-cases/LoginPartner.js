const { randomUUID } = require('node:crypto');

const UsernamePolicy = require('../domain/UsernamePolicy');
const InvalidCredentialsError = require('./errors/InvalidCredentialsError');

class LoginPartner {
  /**
   * @param {object} deps
   * @param {import('../../ports/interfaces').UserRepository} deps.userRepository
   * @param {import('../../ports/interfaces').CredentialRepository} deps.credentialRepository
   * @param {import('../../ports/interfaces').PasswordHasher} deps.passwordHasher
   */
  constructor({ userRepository, credentialRepository, passwordHasher }) {
    this.userRepository = userRepository;
    this.credentialRepository = credentialRepository;
    this.passwordHasher = passwordHasher;
  }

  async execute({ username, password }) {
    // Same normalization as on registration; the lookup is case-insensitive.
    const user = await this.userRepository.findByUsername(UsernamePolicy.normalize(username));
    const credential = user ? await this.credentialRepository.findByUserId(user.id) : null;

    // PA-07: an unknown username must take as long as a wrong password, or
    // the response time reveals which usernames exist. Hash against a dummy
    // value so both paths pay the same bcrypt cost.
    if (!credential) {
      await this.passwordHasher.compare(password, await this.#dummyHash());
      throw new InvalidCredentialsError();
    }

    const isValid = await this.passwordHasher.compare(password, credential.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    return user;
  }

  // Computed once, on first need, with the same hasher (and cost) as real hashes.
  #dummyHashPromise;

  #dummyHash() {
    this.#dummyHashPromise ??= this.passwordHasher.hash(randomUUID());
    return this.#dummyHashPromise;
  }
}

module.exports = LoginPartner;
