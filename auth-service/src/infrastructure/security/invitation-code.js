const { randomInt } = require('node:crypto');

// PA-01: staff hand the invitation code over to the partner directly (no email
// channel in this MVP), so the code is generated with an alphabet that leaves
// out easily confused characters (0/O, 1/I/L) and is printed in groups.
// Randomness comes from node:crypto, never from Math.random().
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const CODE_LENGTH = 12;
const CODE_GROUP_SIZE = 4;

function generateInvitationCode() {
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

module.exports = generateInvitationCode;
module.exports.CODE_ALPHABET = CODE_ALPHABET;
module.exports.CODE_LENGTH = CODE_LENGTH;
