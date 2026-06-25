const { authenticateWithActiveCheck: _authenticate } = require('../../../shared/middlewares/authenticate');
const { env } = require('../config/env');

const authenticate = _authenticate(env.jwtSecret, env.authServiceUrl);

module.exports = { authenticate };
