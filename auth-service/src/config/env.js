require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',

  jwt: {
    secret: required('JWT_SECRET'),
    expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS || 28800), // 8h
  },

  staff: {
    username: required('STAFF_USERNAME'),
    password: required('STAFF_PASSWORD'),
  },

  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 10),
};
