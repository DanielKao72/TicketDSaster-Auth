const PasswordPolicy = require('../domain/PasswordPolicy');
const UserAlreadyExistsError = require('./errors/UserAlreadyExistsError');
const InvalidInvitationError = require('./errors/InvalidInvitationError');

class RegisterPartner {
  /**
   * @param {object} deps
   * @param {import('../../ports/interfaces').UserRepository} deps.userRepository
   * @param {import('../../ports/interfaces').CredentialRepository} deps.credentialRepository
   * @param {import('../../ports/interfaces').InvitationRepository} deps.invitationRepository
   * @param {import('../../ports/interfaces').PasswordHasher} deps.passwordHasher
   */
  constructor({ userRepository, credentialRepository, invitationRepository, passwordHasher }) {
    this.userRepository = userRepository;
    this.credentialRepository = credentialRepository;
    this.invitationRepository = invitationRepository;
    this.passwordHasher = passwordHasher;
  }

  async execute({ username, password, invitationCode }) {
    // PA-06: rejected before touching any store
    PasswordPolicy.validate(password);

    // PA-05-T1
    const existingUser = await this.userRepository.findByUsername(username);
    if (existingUser) {
      throw new UserAlreadyExistsError(username);
    }

    // PA-03-T1
    const invitation = await this.invitationRepository.findByCode(invitationCode);
    if (!invitation) {
      throw new InvalidInvitationError('Invitation code not found');
    }
    if (invitation.used) {
      throw new InvalidInvitationError('Invitation code has already been used');
    }

    // PA-04-T1
    const assignedRole = invitation.role;

    // Hash before creating the user: if hashing fails, no user is left behind
    // without a credential, blocking the username.
    const passwordHash = await this.passwordHasher.hash(password);

    // PA-02-T1
    const user = await this.userRepository.create({ username, role: assignedRole });
    await this.credentialRepository.create({ userId: user.id, passwordHash });

    // PA-03-T1
    invitation.markUsed();
    await this.invitationRepository.save(invitation);

    return user;
  }
}

module.exports = RegisterPartner;
