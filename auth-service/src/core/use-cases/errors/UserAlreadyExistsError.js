// PA-05: the username is already registered. Mapped to 409 by the controller.
class UserAlreadyExistsError extends Error {
  constructor(username) {
    super(`Username '${username}' is already taken`);
    this.name = 'UserAlreadyExistsError';
  }
}

module.exports = UserAlreadyExistsError;
