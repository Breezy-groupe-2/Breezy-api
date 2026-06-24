const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

// Decodes the bearer token when present to expose the viewer id (used for
// isLiked). Never rejects: an anonymous or invalid token just means no viewer
// context, so public reads (feed, profiles) keep working.
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
