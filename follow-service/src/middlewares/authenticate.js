const { authenticateWithActiveCheck: _authenticate } = require('../../../shared/middlewares/authenticate');
const { env } = require('../config/env');

const authenticate = (req, res, next) =>
  _authenticate(env.jwtSecret, process.env.AUTH_SERVICE_URL || 'http://auth-service:3001')(req, res, next);

module.exports = { authenticate };
