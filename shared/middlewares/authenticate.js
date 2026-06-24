const jwt = require('jsonwebtoken');

const authenticate = (jwtSecret) => (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const verifyActiveUser = async (authHeader, authServiceUrl) => {
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

const authenticateWithActiveCheck = (jwtSecret, authServiceUrl) => async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const authError = await verifyActiveUser(authHeader, authServiceUrl);
  if (authError) {
    return res.status(authError.status).json({ error: authError.error });
  }

  next();
};

module.exports = { authenticate, authenticateWithActiveCheck };
