const { loginPartner, InvalidCredentialsError } = require('../../../application/use-cases/login-partner');

function makeLoginController({ userRepository, credentialRepository }) {
  return async function loginController(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    try {
      const user = await loginPartner({ username, password, userRepository, credentialRepository });
      return res.status(200).json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return res.status(401).json({ error: err.message });
      }
      throw err;
    }
  };
}

module.exports = { makeLoginController };
