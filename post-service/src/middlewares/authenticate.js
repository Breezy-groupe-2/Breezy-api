const jwt = require('jsonwebtoken');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user is active by calling auth-service
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
    const response = await fetch(`${authServiceUrl}/api/v1/users/me`, {
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      const status = response.status === 404 ? 404 : 403;
      return res.status(status).json({ error: 'Forbidden' });
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
