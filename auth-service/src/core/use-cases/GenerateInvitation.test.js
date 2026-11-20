const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const GenerateInvitation = require('./GenerateInvitation');
const InMemoryInvitationRepository = require('../../adapters/repositories/InMemoryInvitationRepository');
const InMemoryInvitationExpirationStore = require('../../adapters/repositories/InMemoryInvitationExpirationStore');
const DomainError = require('../domain/errors/DomainError');

function buildGenerateInvitation({ codes = ['CODE-0001-AAAA'], invitationRepository } = {}) {
  const repository = invitationRepository ?? new InMemoryInvitationRepository();
  const pendingCodes = [...codes];

  return {
    invitationRepository: repository,
    generateInvitation: new GenerateInvitation({
      invitationRepository: repository,
      codeGenerator: { generate: () => pendingCodes.shift() ?? 'CODE-FALLBACK' },
      invitationExpirationStore: new InMemoryInvitationExpirationStore(),
      invitationTtlSeconds: 300,
    }),
  };
}

describe('GenerateInvitation', () => {
  // PA-01.1: the request specifies the role and the response returns a code.
  test('genera una invitación con el rol solicitado', async () => {
    const { generateInvitation } = buildGenerateInvitation();

    const invitation = await generateInvitation.execute({ role: 'VENUE_OWNER' });

    assert.equal(invitation.code, 'CODE-0001-AAAA');
    assert.equal(invitation.role, 'VENUE_OWNER');
    assert.equal(invitation.used, false);
  });

  test('persiste la invitación en el store', async () => {
    const { generateInvitation, invitationRepository } = buildGenerateInvitation();

    const invitation = await generateInvitation.execute({ role: 'ORGANIZER' });

    assert.equal(await invitationRepository.findByCode(invitation.code), invitation);
  });

  // PA-03: the code starts its validity window as soon as it is generated.
  test('activa el código durante el TTL configurado', async () => {
    const calls = [];
    const generateInvitation = new GenerateInvitation({
      invitationRepository: new InMemoryInvitationRepository(),
      codeGenerator: { generate: () => 'CODE-0001-AAAA' },
      invitationExpirationStore: { markActive: async (...args) => calls.push(args) },
      invitationTtlSeconds: 300,
    });

    await generateInvitation.execute({ role: 'ORGANIZER' });

    assert.deepEqual(calls, [['CODE-0001-AAAA', 300]]);
  });

  test('falla si el rol no es VENUE_OWNER ni ORGANIZER', async () => {
    const { generateInvitation, invitationRepository } = buildGenerateInvitation();

    await assert.rejects(() => generateInvitation.execute({ role: 'ADMIN' }), DomainError);
    assert.equal(await invitationRepository.existsByCode('CODE-0001-AAAA'), false);
  });

  test('falla si no se recibe un rol', async () => {
    const { generateInvitation } = buildGenerateInvitation();

    await assert.rejects(() => generateInvitation.execute({}), DomainError);
  });

  // PA-01.2: every invitation code generated is unique.
  test('reintenta cuando el código generado ya existe en el store', async () => {
    const { generateInvitation, invitationRepository } = buildGenerateInvitation({
      codes: ['CODE-0001-AAAA', 'CODE-0001-AAAA', 'CODE-0002-BBBB'],
    });

    const first = await generateInvitation.execute({ role: 'VENUE_OWNER' });
    const second = await generateInvitation.execute({ role: 'ORGANIZER' });

    assert.equal(first.code, 'CODE-0001-AAAA');
    assert.equal(second.code, 'CODE-0002-BBBB');
    assert.ok(await invitationRepository.findByCode('CODE-0002-BBBB'));
  });

  test('falla si no logra generar un código único tras los intentos máximos', async () => {
    const invitationRepository = new InMemoryInvitationRepository();
    const generateInvitation = new GenerateInvitation({
      invitationRepository,
      codeGenerator: { generate: () => 'CODE-0001-AAAA' },
      invitationExpirationStore: new InMemoryInvitationExpirationStore(),
      invitationTtlSeconds: 300,
    });

    await generateInvitation.execute({ role: 'ORGANIZER' });

    await assert.rejects(() => generateInvitation.execute({ role: 'ORGANIZER' }), DomainError);
  });

  // PA-03: the validity window is started before the invitation is stored, so
  // a failing store never leaves a code behind that can no longer be used.
  describe('sin invitaciones huérfanas', () => {
    test('si falla el store de vigencia no se guarda la invitación', async () => {
      const invitationRepository = new InMemoryInvitationRepository();
      const generateInvitation = new GenerateInvitation({
        invitationRepository,
        codeGenerator: { generate: () => 'CODE-0001-AAAA' },
        invitationExpirationStore: {
          markActive: async () => {
            throw new Error('redis down');
          },
          revoke: async () => {},
        },
        invitationTtlSeconds: 300,
      });

      await assert.rejects(() => generateInvitation.execute({ role: 'ORGANIZER' }), /redis down/);
      assert.equal(await invitationRepository.existsByCode('CODE-0001-AAAA'), false);
    });

    test('si falla guardar la invitación se revoca su vigencia', async () => {
      const invitationExpirationStore = new InMemoryInvitationExpirationStore();
      const invitationRepository = new InMemoryInvitationRepository();
      invitationRepository.save = async () => {
        throw new Error('postgres down');
      };
      const generateInvitation = new GenerateInvitation({
        invitationRepository,
        codeGenerator: { generate: () => 'CODE-0001-AAAA' },
        invitationExpirationStore,
        invitationTtlSeconds: 300,
      });

      await assert.rejects(() => generateInvitation.execute({ role: 'ORGANIZER' }), /postgres down/);
      assert.equal(await invitationExpirationStore.isActive('CODE-0001-AAAA'), false);
    });

    test('un fallo al revocar no oculta el error original', async () => {
      const invitationRepository = new InMemoryInvitationRepository();
      invitationRepository.save = async () => {
        throw new Error('postgres down');
      };
      const generateInvitation = new GenerateInvitation({
        invitationRepository,
        codeGenerator: { generate: () => 'CODE-0001-AAAA' },
        invitationExpirationStore: {
          markActive: async () => {},
          revoke: async () => {
            throw new Error('redis down');
          },
        },
        invitationTtlSeconds: 300,
      });

      await assert.rejects(() => generateInvitation.execute({ role: 'ORGANIZER' }), /postgres down/);
    });
  });
});
