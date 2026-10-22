const { createHash, timingSafeEqual } = require('node:crypto');

// PA-01-T2 / PA-01.4: guard for staff-only routes (POST /invitations). The
// staff credential comes from configuration (STAFF_USERNAME / STAFF_PASSWORD
// through src/infrastructure/config/Env.js), never from source code. Rejected
// requests never reach the handler behind this middleware.
//
// Status codes follow docs/contributing/code-standards.md: a missing or wrong
// credential is 401. The message never says whether the username or the
// password was the wrong one.
class StaffCredentialGuard {
  // Sent with every 401 so HTTP clients know the route expects Basic Auth.
  static CHALLENGE = 'Basic realm="D-Saster Staff", charset="UTF-8"';

  #username;
  #password;

  constructor({ username, password }) {
    // Fail closed: an empty configured credential must never match an empty one
    // sent by the caller, so the app refuses to start instead.
    if (!username || !password) {
      throw new Error('Staff credentials are not configured (STAFF_USERNAME and STAFF_PASSWORD)');
    }

    this.#username = username;
    this.#password = password;
  }

  handle = (req, res, next) => {
    const { authorization } = req.headers;

    if (!authorization) {
      return StaffCredentialGuard.#reject(res, 'Staff credential required');
    }

    const credentials = StaffCredentialGuard.parseBasicCredentials(authorization);

    if (!credentials) {
      return StaffCredentialGuard.#reject(res, 'Invalid staff credential');
    }

    // Both comparisons always run, so a wrong username does not answer faster
    // than a wrong password.
    const usernameMatches = StaffCredentialGuard.#safeEqual(credentials.username, this.#username);
    const passwordMatches = StaffCredentialGuard.#safeEqual(credentials.password, this.#password);

    if (!usernameMatches || !passwordMatches) {
      return StaffCredentialGuard.#reject(res, 'Invalid staff credential');
    }

    return next();
  };

  // Reads "Authorization: Basic base64(username:password)". Returns null when the
  // header is not a well-formed Basic credential. The password may contain ':',
  // so only the first one separates it from the username.
  static parseBasicCredentials(authorization) {
    const [scheme, encoded, ...extra] = authorization.trim().split(/\s+/);

    if (scheme.toLowerCase() !== 'basic' || !encoded || extra.length > 0) {
      return null;
    }

    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  }

  // Hashing both sides gives timingSafeEqual buffers of equal length, so neither
  // the content nor the length of the expected value leaks through response time.
  static #digest(value) {
    return createHash('sha256').update(value).digest();
  }

  static #safeEqual(received, expected) {
    return timingSafeEqual(StaffCredentialGuard.#digest(received), StaffCredentialGuard.#digest(expected));
  }

  static #reject(res, message) {
    return res.status(401).set('WWW-Authenticate', StaffCredentialGuard.CHALLENGE).json({ error: message });
  }
}

module.exports = StaffCredentialGuard;
