const { createHash, timingSafeEqual } = require('node:crypto');

// Sent with every 401 so HTTP clients know the route expects Basic Auth.
const STAFF_CHALLENGE = 'Basic realm="D-Saster Staff", charset="UTF-8"';

// Hashing both sides gives timingSafeEqual buffers of equal length, so neither
// the content nor the length of the expected value leaks through response time.
function digest(value) {
  return createHash('sha256').update(value).digest();
}

function safeEqual(received, expected) {
  return timingSafeEqual(digest(received), digest(expected));
}

// Reads "Authorization: Basic base64(username:password)". Returns null when the
// header is not a well-formed Basic credential. The password may contain ':',
// so only the first one separates it from the username.
function parseBasicCredentials(authorization) {
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

function reject(res, message) {
  return res.status(401).set('WWW-Authenticate', STAFF_CHALLENGE).json({ error: message });
}

// PA-01-T2 / PA-01.4: guard for staff-only routes (POST /invitations). The
// staff credential comes from configuration (STAFF_USERNAME / STAFF_PASSWORD
// through src/config/env.js), never from source code. Rejected requests never
// reach the handler behind this middleware.
//
// Status codes follow docs/contributing/code-standards.md: a missing or wrong
// credential is 401. The message never says whether the username or the
// password was the wrong one.
function createRequireStaffCredential({ username, password }) {
  // Fail closed: an empty configured credential must never match an empty one
  // sent by the caller, so the app refuses to start instead.
  if (!username || !password) {
    throw new Error('Staff credentials are not configured (STAFF_USERNAME and STAFF_PASSWORD)');
  }

  return function requireStaffCredential(req, res, next) {
    const { authorization } = req.headers;

    if (!authorization) {
      return reject(res, 'Staff credential required');
    }

    const credentials = parseBasicCredentials(authorization);

    if (!credentials) {
      return reject(res, 'Invalid staff credential');
    }

    // Both comparisons always run, so a wrong username does not answer faster
    // than a wrong password.
    const usernameMatches = safeEqual(credentials.username, username);
    const passwordMatches = safeEqual(credentials.password, password);

    if (!usernameMatches || !passwordMatches) {
      return reject(res, 'Invalid staff credential');
    }

    return next();
  };
}

module.exports = createRequireStaffCredential;
