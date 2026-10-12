const { loginPartner, InvalidCredentialsError } = require('../../../application/use-cases/login-partner');
const { generateToken } = require('../../security/jwt');
const config = require('../../../config/env');

function makeLoginController({ userRepository, credentialRepository }) {
  return async function loginController(req, res, next) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'username and password must be strings' });
    }

    try {
      const user = await loginPartner({ username, password, userRepository, credentialRepository });
      const accessToken = generateToken({ userId: user.id, role: user.role });
      return res.status(200).json({
        accessToken,
        tokenType: 'Bearer',
        expiresIn: config.jwt.expiresInSeconds,
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return res.status(401).json({ error: err.message });
      }
      return next(err);
    }
  };
}

module.exports = { makeLoginController };
