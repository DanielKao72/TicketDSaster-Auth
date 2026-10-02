const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// Wraps bcrypt so the rest of the app never touches the library directly.
// PA-06: passwords are never stored in readable form — only this hash leaves this module.
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = { hashPassword, comparePassword };