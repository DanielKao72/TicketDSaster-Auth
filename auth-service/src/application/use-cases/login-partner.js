const { comparePassword } = require('../../infrastructure/security/password-hasher');

const INVALID_CREDENTIALS_MESSAGE = 'Invalid username or password';

class InvalidCredentialsError extends Error {
  constructor() {
    super(INVALID_CREDENTIALS_MESSAGE);
    this.name = 'InvalidCredentialsError';
  }
}

async function loginPartner({ username, password, userRepository, credentialRepository }) {
  const user = await userRepository.findByUsername(username);
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const credential = await credentialRepository.findByUserId(user.id);
  if (!credential) {
    throw new InvalidCredentialsError();
  }

  const isValid = await comparePassword(password, credential.passwordHash);
  if (!isValid) {
    throw new InvalidCredentialsError();
  }

  return user;
}

module.exports = { loginPartner, InvalidCredentialsError };
