const DomainError = require('./errors/DomainError');

// PA-02 / PA-05: usernames are 3 to 50 characters of letters, digits, '.', '_'
// and '-', with surrounding whitespace ignored. They are unique regardless of
// case ('Venue1' and 'venue1' are the same user): the stores look them up and
// enforce uniqueness case-insensitively, but keep the case as registered.
class UsernamePolicy {
  static MIN_LENGTH = 3;
  static MAX_LENGTH = 50;
  static PATTERN = /^[A-Za-z0-9._-]+$/;

  // Applied to every incoming username, on registration and on login.
  static normalize(username) {
    return typeof username === 'string' ? username.trim() : username;
  }

  static validate(username) {
    const { MIN_LENGTH, MAX_LENGTH, PATTERN } = UsernamePolicy;

    if (typeof username !== 'string' || username.length < MIN_LENGTH || username.length > MAX_LENGTH) {
      throw new DomainError(`Username must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters long`);
    }
    if (!PATTERN.test(username)) {
      throw new DomainError("Username may only contain letters, digits, '.', '_' and '-'");
    }
  }
}

module.exports = UsernamePolicy;
