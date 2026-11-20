const { randomInt } = require('node:crypto');

const { CodeGenerator } = require('../../ports/interfaces');

// PA-01: staff hand the invitation code over to the partner directly (no email
// channel in this MVP), so the code is generated with an alphabet that leaves
// out easily confused characters (0/O, 1/I/L) and is printed in groups.
// Randomness comes from node:crypto, never from Math.random().
class InvitationCodeGenerator extends CodeGenerator {
  static CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  static CODE_LENGTH = 12;
  static CODE_GROUP_SIZE = 4;

  generate() {
    const { CODE_ALPHABET, CODE_LENGTH, CODE_GROUP_SIZE } = InvitationCodeGenerator;

    const characters = Array.from(
      { length: CODE_LENGTH },
      () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
    );

    const groups = [];
    for (let index = 0; index < CODE_LENGTH; index += CODE_GROUP_SIZE) {
      groups.push(characters.slice(index, index + CODE_GROUP_SIZE).join(''));
    }

    return groups.join('-');
  }
}

module.exports = InvitationCodeGenerator;
