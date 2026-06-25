const { authenticate: _authenticate } = require('../../../shared/middlewares/authenticate');
const { env } = require('../config/env');

const authenticate = _authenticate(env.jwtSecret);

module.exports = { authenticate };
