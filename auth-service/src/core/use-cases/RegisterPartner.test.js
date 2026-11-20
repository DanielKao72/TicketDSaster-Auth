const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const RegisterPartner = require('./RegisterPartner');
const UserAlreadyExistsError = require('./errors/UserAlreadyExistsError');
const InvalidInvitationError = require('./errors/InvalidInvitationError');
const ExpiredInvitationError = require('./errors/ExpiredInvitationError');
const Invitation = require('../domain/entities/Invitation');
const DomainError = require('../domain/errors/DomainError');
const { ROLES } = require('../domain/Roles');
const BcryptPasswordHasher = require('../../adapters/services/BcryptPasswordHasher');
const InMemoryUnitOfWork = require('../../adapters/repositories/InMemoryUnitOfWork');

const passwordHasher = new BcryptPasswordHasher();

// Builds the use case with the given stores and runs it with the remaining
// input. Unless a test passes its own, every invitation code counts as active.
function registerPartner({
  userRepository,
  credentialRepository,
  invitationRepository,
  invitationExpirationStore = makeFakeExpirationStore({ activeByDefault: true }),
  ...input
}) {
  const unitOfWork = new InMemoryUnitOfWork({ userRepository, credentialRepository, invitationRepository });
  return new RegisterPartner({
    userRepository,
    credentialRepository,
    invitationRepository,
    passwordHasher,
    invitationExpirationStore,
    unitOfWork,
  }).execute(input);
}

// PA-03: records every call so tests can check the order of the checks.
function makeFakeExpirationStore({ activeByDefault = false, activeCodes = [] } = {}) {
  const active = new Set(activeCodes);
  const calls = [];
  return {
    isActive: async (code) => {
      calls.push(['isActive', code]);
      return activeByDefault || active.has(code);
    },
    revoke: async (code) => {
      calls.push(['revoke', code]);
      active.delete(code);
    },
    _calls: calls,
  };
}

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

describe('RegisterPartner', () => {
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

  test('PA-06: rechaza passwords cortos sin crear usuario ni consumir el codigo', async () => {
    const invitation = new Invitation({ code: 'INV-6', role: ROLES.ORGANIZER });
    const userRepository = makeFakeUserRepository();
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([invitation]);

    await assert.rejects(
      () => registerPartner({
        username: 'ana',
        password: 'short',
        invitationCode: 'INV-6',
        userRepository,
        credentialRepository,
        invitationRepository,
      }),
      DomainError,
    );

    assert.equal(userRepository._created.length, 0);
    assert.equal(invitation.used, false);
  });

  test('PA-06: rechaza un password que no es string sin dejar un usuario huérfano', async () => {
    const invitation = new Invitation({ code: 'INV-7', role: ROLES.ORGANIZER });
    const userRepository = makeFakeUserRepository();
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([invitation]);

    await assert.rejects(
      () => registerPartner({
        username: 'ana',
        password: 12345678,
        invitationCode: 'INV-7',
        userRepository,
        credentialRepository,
        invitationRepository,
      }),
      DomainError,
    );

    assert.equal(userRepository._created.length, 0);
    assert.equal(credentialRepository._saved.length, 0);
    assert.equal(invitation.used, false);
  });

  test('PA-03: lanza ExpiredInvitationError si el codigo ya no esta activo', async () => {
    const invitation = new Invitation({ code: 'INV-8', role: ROLES.ORGANIZER });
    const userRepository = makeFakeUserRepository();
    const credentialRepository = makeFakeCredentialRepository();
    const invitationRepository = makeFakeInvitationRepository([invitation]);

    await assert.rejects(
      () => registerPartner({
        username: 'ana',
        password: 'mySecret123',
        invitationCode: 'INV-8',
        userRepository,
        credentialRepository,
        invitationRepository,
        invitationExpirationStore: makeFakeExpirationStore(),
      }),
      { name: 'ExpiredInvitationError', message: 'Invitation code has expired' },
    );

    assert.equal(userRepository._created.length, 0);
    assert.equal(invitation.used, false);
  });

  test('PA-03: un codigo caducado sigue siendo un InvalidInvitationError', () => {
    assert.ok(new ExpiredInvitationError() instanceof InvalidInvitationError);
  });

  test('PA-03: un codigo usado se rechaza sin consultar su vigencia', async () => {
    const invitation = new Invitation({ code: 'INV-9', role: ROLES.ORGANIZER });
    invitation.markUsed();
    const invitationExpirationStore = makeFakeExpirationStore({ activeCodes: ['INV-9'] });

    await assert.rejects(
      () => registerPartner({
        username: 'ana',
        password: 'mySecret123',
        invitationCode: 'INV-9',
        userRepository: makeFakeUserRepository(),
        credentialRepository: makeFakeCredentialRepository(),
        invitationRepository: makeFakeInvitationRepository([invitation]),
        invitationExpirationStore,
      }),
      { message: 'Invitation code has already been used' },
    );

    assert.deepEqual(invitationExpirationStore._calls, []);
  });

  test('PA-03: tras registrar marca el codigo como usado y libera su vigencia', async () => {
    const invitation = new Invitation({ code: 'INV-10', role: ROLES.ORGANIZER });
    const invitationRepository = makeFakeInvitationRepository([invitation]);
    const invitationExpirationStore = makeFakeExpirationStore({ activeCodes: ['INV-10'] });

    await registerPartner({
      username: 'ana',
      password: 'mySecret123',
      invitationCode: 'INV-10',
      userRepository: makeFakeUserRepository(),
      credentialRepository: makeFakeCredentialRepository(),
      invitationRepository,
      invitationExpirationStore,
    });

    assert.equal((await invitationRepository.findByCode('INV-10')).used, true);
    assert.deepEqual(invitationExpirationStore._calls, [['isActive', 'INV-10'], ['revoke', 'INV-10']]);
  });

  test('PA-03: no consume el codigo si falla guardar la credencial', async () => {
    const invitation = new Invitation({ code: 'INV-11', role: ROLES.ORGANIZER });
    const credentialRepository = {
      create: async () => {
        throw new Error('store down');
      },
    };

    await assert.rejects(
      () => registerPartner({
        username: 'ana',
        password: 'mySecret123',
        invitationCode: 'INV-11',
        userRepository: makeFakeUserRepository(),
        credentialRepository,
        invitationRepository: makeFakeInvitationRepository([invitation]),
      }),
      /store down/,
    );

    assert.equal(invitation.used, false);
  });

  test('un fallo al liberar la vigencia no invalida un registro ya confirmado', async () => {
    const invitation = new Invitation({ code: 'INV-12', role: ROLES.ORGANIZER });

    const user = await registerPartner({
      username: 'ana',
      password: 'mySecret123',
      invitationCode: 'INV-12',
      userRepository: makeFakeUserRepository(),
      credentialRepository: makeFakeCredentialRepository(),
      invitationRepository: makeFakeInvitationRepository([invitation]),
      invitationExpirationStore: {
        isActive: async () => true,
        revoke: async () => {
          throw new Error('redis down');
        },
      },
    });

    assert.equal(user.username, 'ana');
    assert.equal(invitation.used, true);
  });
});
