const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

const requireInternalApiKey = (req, res, next) => {
  if (!INTERNAL_API_KEY) {
    return res.status(500).json({ error: 'Internal authentication not configured' });
  }

  const providedKey = req.headers['x-internal-api-key'];
  if (providedKey !== INTERNAL_API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

module.exports = { requireInternalApiKey };
