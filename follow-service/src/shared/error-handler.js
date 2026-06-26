const DEFAULT_INTERNAL_ERROR_MESSAGE = 'Internal server error';

const getStatusCode = (err) => {
  const status = err.status ?? err.statusCode;
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
};

const isPublicError = (err, statusCode) => err.expose === true || statusCode < 500;

const errorHandler = (err, _req, res, _next) => {
  console.error(err);

  const statusCode = getStatusCode(err);
  const publicError = isPublicError(err, statusCode);
  const body = {
    error: publicError && err.message ? err.message : DEFAULT_INTERNAL_ERROR_MESSAGE,
  };

  if (publicError && err.details) {
    body.details = err.details;
  }

  res.status(statusCode).json(body);
};

module.exports = {
  DEFAULT_INTERNAL_ERROR_MESSAGE,
  errorHandler,
  getStatusCode,
};
