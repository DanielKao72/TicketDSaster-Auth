const {
  registerPartner,
  UserAlreadyExistsError,
  InvalidInvitationError,
} = require('../../../application/use-cases/register-partner');

function makeRegisterController({ userRepository, credentialRepository, invitationRepository }) {
  return async function registerController(req, res) {
    const { username, password, invitationCode } = req.body;

    if (!username || !password || !invitationCode) {
      return res.status(400).json({ error: 'username, password and invitationCode are required' });
    }

    try {
      const user = await registerPartner({
        username,
        password,
        invitationCode,
        userRepository,
        credentialRepository,
        invitationRepository,
      });
      return res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
      if (err instanceof UserAlreadyExistsError) {
        return res.status(409).json({ error: err.message });
      }
      if (err instanceof InvalidInvitationError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }
  };
}

module.exports = { makeRegisterController };