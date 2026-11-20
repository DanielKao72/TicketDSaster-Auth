const UserAlreadyExistsError = require('../../core/use-cases/errors/UserAlreadyExistsError');
const InvalidInvitationError = require('../../core/use-cases/errors/InvalidInvitationError');

// POST /auth/register (PA-02..PA-06): translates HTTP in and out of RegisterPartner.
class RegisterController {
  /** @param {{ registerPartner: import('../../core/use-cases/RegisterPartner') }} deps */
  constructor({ registerPartner }) {
    this.registerPartner = registerPartner;
  }

  handle = async (req, res, next) => {
    const { username, password, invitationCode } = req.body;

    if (!username || !password || !invitationCode) {
      return res.status(400).json({ error: 'username, password and invitationCode are required' });
    }
    if ([username, password, invitationCode].some((field) => typeof field !== 'string')) {
      return res.status(400).json({ error: 'username, password and invitationCode must be strings' });
    }

    try {
      const user = await this.registerPartner.execute({ username, password, invitationCode });
      return res.status(201).json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
      if (err instanceof UserAlreadyExistsError) {
        return res.status(409).json({ error: err.message });
      }
      if (err instanceof InvalidInvitationError) {
        return res.status(400).json({ error: err.message });
      }
      return next(err);
    }
  };
}

module.exports = RegisterController;
