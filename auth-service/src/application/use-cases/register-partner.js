//const { hashPassword } = require('../../infrastructure/security/password-hasher');

const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

class UserAlreadyExistsError extends Error {
  constructor(username) {
    super(`Username '${username}' is already taken`);
    this.name = 'UserAlreadyExistsError';
  }
}

class InvalidInvitationError extends Error {
  constructor(message = 'Invalid or already consumed invitation code') {
    super(message);
    this.name = 'InvalidInvitationError';
  }
}

async function registerPartner({
  username,
  password,
  invitationCode,
  userRepository,
  credentialRepository,
  invitationRepository,
}) {
  // PA-05-T1
  const existingUser = await userRepository.findByUsername(username);
  if (existingUser) {
    throw new UserAlreadyExistsError(username);
  }

  // PA-03-T1
  const invitation = await invitationRepository.findByCode(invitationCode);
  if (!invitation) {
    throw new InvalidInvitationError('Invitation code not found');
  }
  if (invitation.used) {
    throw new InvalidInvitationError('Invitation code has already been used');
  }

  // PA-04-T1
  const assignedRole = invitation.role;

  // PA-02-T1
  const user = await userRepository.create({ username, role: assignedRole });

  const passwordHash = await hashPassword(password);
  await credentialRepository.create({ userId: user.id, passwordHash });

  // PA-03-T1
  invitation.markUsed();
  await invitationRepository.save(invitation);

  return user;
}

module.exports = { registerPartner, UserAlreadyExistsError, InvalidInvitationError };