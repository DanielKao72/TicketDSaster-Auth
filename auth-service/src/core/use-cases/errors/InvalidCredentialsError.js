const INVALID_CREDENTIALS_MESSAGE = 'Invalid username or password';

// PA-07: one message for unknown user and wrong password, so the response
// never reveals which one failed.
class InvalidCredentialsError extends Error {
  constructor() {
    super(INVALID_CREDENTIALS_MESSAGE);
    this.name = 'InvalidCredentialsError';
  }
}

module.exports = InvalidCredentialsError;
