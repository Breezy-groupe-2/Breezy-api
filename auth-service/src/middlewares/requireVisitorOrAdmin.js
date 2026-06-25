const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

/**
 * Middleware that allows unauthenticated visitors AND admins, but blocks
 * regular users and moderators.
 *
 * Used on POST /auth/register to match the project rights matrix:
 *   Visitor: allowed | User: blocked | Moderator: blocked | Admin: allowed
 */
const requireVisitorOrAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // No token → visitor → allow
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  // Token present → verify and check role
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (payload.role === 'admin') {
      return next();
    }

    // Authenticated user or moderator → block
    return res.status(403).json({
      error: 'Registration is restricted to visitors and administrators',
    });
  } catch {
    // Invalid token → treat as visitor → allow (authenticate will catch it later if needed)
    return next();
  }
};

module.exports = { requireVisitorOrAdmin };
