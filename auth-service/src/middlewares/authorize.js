const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    const err = new Error('Forbidden');
    err.status = 403;
    return next(err);
  }
  next();
};

module.exports = { requireRole };
