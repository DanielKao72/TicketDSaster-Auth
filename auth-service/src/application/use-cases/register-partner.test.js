const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  registerPartner,
  UserAlreadyExistsError,
  InvalidInvitationError,
} = require('./register-partner');
const Invitation = require('../../domain/entities/Invitation');
const { ROLES } = require('../../domain/roles');

function makeFakeUserRepository(existingUsers = []) {
  const created = [];
  return {
    findByUsername: async (username) =>
      [...existingUsers, ...created].find((u) => u.username === username) ?? null,
    create: async ({ username, role }) => {
      const user = { id: `u-${created.length + 1}`, username, role };
      created.push(user);
      return user;
    },
    _created: created,
  };
}

function makeFakeCredentialRepository() {
  const saved = [];
  return {
    create: async ({ userId, passwordHash }) => {
      saved.push({ userId, passwordHash });
      return { userId, passwordHash };
    },
    _saved: saved,
  };
}

function makeFakeInvitationRepository(invitations = []) {
  const store = new Map(invitations.map((inv) => [inv.code, inv]));
  return {
    findByCode: async (code) => store.get(code) ?? null,
    save: async (invitation) => {
      store.set(invitation.code, invitation);
      return invitation;
    },
  };
}

describe('registerPartner', () => {
  test('PA-02: registra al usuario y crea su credencial con codigo valido', async () => {
    const invitation = new Invitation({ code: 'INV-1', role: ROLES.ORGANIZER });
    const userRepository = makeFakeUserRepository();
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([invitation]);

    const user = await registerPartner({
      username: 'ana',
      password: 'mySecret123',
      invitationCode: 'INV-1',
      userRepository,
      credentialRepository,
      invitationRepository,
    });

    assert.equal(user.username, 'ana');
    assert.equal(userRepository._created.length, 1);
    assert.equal(credentialRepository._saved.length, 1);
    assert.notEqual(credentialRepository._saved[0].passwordHash, 'mySecret123');
  });

  test('PA-04: el rol asignado viene de la invitacion, no del input', async () => {
    const invitation = new Invitation({ code: 'INV-2', role: ROLES.VENUE_OWNER });
    const userRepository = makeFakeUserRepository();
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([invitation]);

    const user = await registerPartner({
      username: 'luis',
      password: 'mySecret123',
      invitationCode: 'INV-2',
      userRepository,
      credentialRepository,
      invitationRepository,
    });

    assert.equal(user.role, ROLES.VENUE_OWNER);
  });

  test('PA-05: lanza UserAlreadyExistsError si el username ya existe', async () => {
    const invitation = new Invitation({ code: 'INV-3', role: ROLES.ORGANIZER });
    const userRepository = makeFakeUserRepository([{ id: 'u0', username: 'ana', role: ROLES.ORGANIZER }]);
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([invitation]);

    await assert.rejects(
      () => registerPartner({
        username: 'ana',
        password: 'mySecret123',
        invitationCode: 'INV-3',
        userRepository,
        credentialRepository,
        invitationRepository,
      }),
      UserAlreadyExistsError,
    );
  });

  test('PA-03: lanza InvalidInvitationError si el codigo no existe', async () => {
    const userRepository = makeFakeUserRepository();
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([]);

    await assert.rejects(
      () => registerPartner({
        username: 'ana',
        password: 'mySecret123',
        invitationCode: 'NO-EXISTE',
        userRepository,
        credentialRepository,
        invitationRepository,
      }),
      InvalidInvitationError,
    );
  });

  test('PA-03: lanza InvalidInvitationError si el codigo ya fue usado', async () => {
    const invitation = new Invitation({ code: 'INV-4', role: ROLES.ORGANIZER });
    invitation.markUsed();
    const userRepository = makeFakeUserRepository();
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([invitation]);

    await assert.rejects(
      () => registerPartner({
        username: 'ana',
        password: 'mySecret123',
        invitationCode: 'INV-4',
        userRepository,
        credentialRepository,
        invitationRepository,
      }),
      InvalidInvitationError,
    );
  });

  test('PA-03: no consume el codigo si el username ya existe', async () => {
    const invitation = new Invitation({ code: 'INV-5', role: ROLES.ORGANIZER });
    const userRepository = makeFakeUserRepository([{ id: 'u0', username: 'ana', role: ROLES.ORGANIZER }]);
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([invitation]);

    await assert.rejects(() => registerPartner({
      username: 'ana',
      password: 'mySecret123',
      invitationCode: 'INV-5',
      userRepository,
      credentialRepository,
      invitationRepository,
    }));

    const stillFresh = await invitationRepository.findByCode('INV-5');
    assert.equal(stillFresh.used, false);
  });
});