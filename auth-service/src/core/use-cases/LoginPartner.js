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
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const credential = await this.credentialRepository.findByUserId(user.id);
    if (!credential) {
      throw new InvalidCredentialsError();
    }

    const isValid = await this.passwordHasher.compare(password, credential.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    return user;
  }
}

module.exports = LoginPartner;
