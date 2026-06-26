const crypto = require('crypto');
const { env } = require('../config/env');

const tokensMatch = (candidate, expected) => {
  const candidateBuffer = Buffer.from(candidate || '');
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
  );
};

const requireInternalServiceToken = (req, res, next) => {
  const token = req.get('x-internal-service-token');

  if (!tokensMatch(token, env.internalServiceToken)) {
    return res.status(401).json({ error: 'Unauthorized internal service request' });
  }

  return next();
};

module.exports = { requireInternalServiceToken };
