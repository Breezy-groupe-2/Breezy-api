const { authenticateWithActiveCheck: _authenticate } = require('../../../shared/middlewares/authenticate');
const { env } = require('../config/env');

const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const authenticate = _authenticate(env.jwtSecret, authServiceUrl);

module.exports = { authenticate };
