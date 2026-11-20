const PasswordPolicy = require('../domain/PasswordPolicy');
const UserAlreadyExistsError = require('./errors/UserAlreadyExistsError');
const InvalidInvitationError = require('./errors/InvalidInvitationError');
const ExpiredInvitationError = require('./errors/ExpiredInvitationError');

class RegisterPartner {
  /**
   * @param {object} deps
   * @param {import('../../ports/interfaces').UserRepository} deps.userRepository
   * @param {import('../../ports/interfaces').CredentialRepository} deps.credentialRepository
   * @param {import('../../ports/interfaces').InvitationRepository} deps.invitationRepository
   * @param {import('../../ports/interfaces').PasswordHasher} deps.passwordHasher
   * @param {import('../../ports/interfaces').InvitationExpirationStore} deps.invitationExpirationStore
   * @param {import('../../ports/interfaces').UnitOfWork} deps.unitOfWork
   */
  constructor({
    userRepository,
    credentialRepository,
    invitationRepository,
    passwordHasher,
    invitationExpirationStore,
    unitOfWork,
  }) {
    this.userRepository = userRepository;
    this.credentialRepository = credentialRepository;
    this.invitationRepository = invitationRepository;
    this.passwordHasher = passwordHasher;
    this.invitationExpirationStore = invitationExpirationStore;
    this.unitOfWork = unitOfWork;
  }

  async execute({ username, password, invitationCode }) {
    // PA-06: rejected before touching any store
    PasswordPolicy.validate(password);

    // PA-05-T1
    const existingUser = await this.userRepository.findByUsername(username);
    if (existingUser) {
      throw new UserAlreadyExistsError(username);
    }

    // PA-03-T1: a consumed code is rejected before its time window is checked.
    const invitation = await this.invitationRepository.findByCode(invitationCode);
    if (!invitation) {
      throw new InvalidInvitationError('Invitation code not found');
    }
    if (invitation.used) {
      throw new InvalidInvitationError('Invitation code has already been used');
    }
    if (!(await this.invitationExpirationStore.isActive(invitationCode))) {
      throw new ExpiredInvitationError();
    }

    // PA-04-T1
    const assignedRole = invitation.role;

    // Hash before opening the transaction: hashing is slow and needs no store.
    const passwordHash = await this.passwordHasher.hash(password);

    // PA-02-T1 + PA-03-T1: the user, its credential and the consumed code are
    // committed together, so the code is only marked used if registration
    // fully succeeds and no user is left without a credential.
    const user = await this.unitOfWork.run(async ({ userRepository, credentialRepository, invitationRepository }) => {
      const createdUser = await userRepository.create({ username, role: assignedRole });
      await credentialRepository.create({ userId: createdUser.id, passwordHash });

      invitation.markUsed();
      await invitationRepository.save(invitation);

      return createdUser;
    });

    // The used flag already blocks reuse; this only frees the expiration entry,
    // so a failure here must not turn a committed registration into an error.
    await this.invitationExpirationStore.revoke(invitationCode).catch(() => {});

    return user;
  }
}

module.exports = RegisterPartner;
