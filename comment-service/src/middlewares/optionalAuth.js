const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

// Decodes the bearer token when present to expose the viewer id (used for
// isLiked on comments/replies). Never rejects: anonymous reads still work.
const optionalAuth = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), env.jwtSecret);
      req.viewerId = payload.sub;
    } catch {
      /* ignore invalid token, treat as anonymous */
    }
  }
  next();
};

module.exports = { optionalAuth };
