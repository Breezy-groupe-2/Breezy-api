const jwt = require('jsonwebtoken');

const verifyActiveUser = async (authHeader) => {
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
  let response;

  try {
    response = await fetch(`${authServiceUrl}/api/v1/users/me`, {
      headers: { Authorization: authHeader },
    });
  } catch {
    return { status: 502, error: 'Auth service unavailable' };
  }

  if (response.ok) {
    return null;
  }

  if (response.status === 404) {
    return { status: 404, error: 'User not found' };
  }

  if (response.status >= 500) {
    return { status: 502, error: 'Auth service unavailable' };
  }

  return { status: 403, error: 'Forbidden' };
};

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const authError = await verifyActiveUser(authHeader);
  if (authError) {
    return res.status(authError.status).json({ error: authError.error });
  }

  next();
};

module.exports = { authenticate };
