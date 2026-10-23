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
});
