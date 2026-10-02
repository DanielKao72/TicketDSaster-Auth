const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const createGenerateInvitation = require('./generate-invitation');
const InMemoryInvitationRepository = require('../../infrastructure/persistence/in-memory-invitation.repository');
const DomainError = require('../../domain/errors/DomainError');

function buildGenerateInvitation({ codes = ['CODE-0001-AAAA'], invitationRepository } = {}) {
  const repository = invitationRepository ?? new InMemoryInvitationRepository();
  const pendingCodes = [...codes];

  return {
    invitationRepository: repository,
    generateInvitation: createGenerateInvitation({
      invitationRepository: repository,
      generateInvitationCode: () => pendingCodes.shift() ?? 'CODE-FALLBACK',
    }),
  };
}

describe('generateInvitation', () => {
  // PA-01.1: the request specifies the role and the response returns a code.
  test('genera una invitación con el rol solicitado', async () => {
    const { generateInvitation } = buildGenerateInvitation();

    const invitation = await generateInvitation({ role: 'VENUE_OWNER' });

    assert.equal(invitation.code, 'CODE-0001-AAAA');
    assert.equal(invitation.role, 'VENUE_OWNER');
    assert.equal(invitation.used, false);
  });

  test('persiste la invitación en el store', async () => {
    const { generateInvitation, invitationRepository } = buildGenerateInvitation();

    const invitation = await generateInvitation({ role: 'ORGANIZER' });

    assert.equal(await invitationRepository.findByCode(invitation.code), invitation);
  });

  test('falla si el rol no es VENUE_OWNER ni ORGANIZER', async () => {
    const { generateInvitation, invitationRepository } = buildGenerateInvitation();

    await assert.rejects(() => generateInvitation({ role: 'ADMIN' }), DomainError);
    assert.equal(await invitationRepository.existsByCode('CODE-0001-AAAA'), false);
  });

  test('falla si no se recibe un rol', async () => {
    const { generateInvitation } = buildGenerateInvitation();

    await assert.rejects(() => generateInvitation({}), DomainError);
  });

  // PA-01.2: every invitation code generated is unique.
  test('reintenta cuando el código generado ya existe en el store', async () => {
    const { generateInvitation, invitationRepository } = buildGenerateInvitation({
      codes: ['CODE-0001-AAAA', 'CODE-0001-AAAA', 'CODE-0002-BBBB'],
    });

    const first = await generateInvitation({ role: 'VENUE_OWNER' });
    const second = await generateInvitation({ role: 'ORGANIZER' });

    assert.equal(first.code, 'CODE-0001-AAAA');
    assert.equal(second.code, 'CODE-0002-BBBB');
    assert.ok(await invitationRepository.findByCode('CODE-0002-BBBB'));
  });

  test('falla si no logra generar un código único tras los intentos máximos', async () => {
    const invitationRepository = new InMemoryInvitationRepository();
    const generateInvitation = createGenerateInvitation({
      invitationRepository,
      generateInvitationCode: () => 'CODE-0001-AAAA',
    });

    await generateInvitation({ role: 'ORGANIZER' });

    await assert.rejects(() => generateInvitation({ role: 'ORGANIZER' }), DomainError);
  });
});
