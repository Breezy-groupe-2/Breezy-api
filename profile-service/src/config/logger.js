const pino = require('pino');

const serviceName = 'profile-service';

const createLogger = (opts = {}) => {
  const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

  return pino({
    name: serviceName,
    level,
    redact: {
      paths: ['password', 'passwordHash', 'token', 'jwt', 'req.headers.authorization'],
      censor: '[REDACTED]',
    },
    ...opts,
  });
};

module.exports = { createLogger };
