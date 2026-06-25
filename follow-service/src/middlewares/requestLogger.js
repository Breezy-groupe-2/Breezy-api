const { randomUUID } = require('crypto');

const requestLogger = (logger) => (req, res, next) => {
  const requestId = req.headers['x-request-id'] || randomUUID();
  const start = Date.now();

  req.log = logger.child({ requestId });

  res.on('finish', () => {
    const duration = Date.now() - start;
    req.log.info({
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
    }, 'request completed');
  });

  next();
};

module.exports = { requestLogger };
