const User = require('../models/user.model');

const checkActive = async (req, res, next) => {
  if (!req.user || !req.user.sub) {
    return next();
  }

  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      const err = new Error('User not found');
      err.status = 404;
      return next(err);
    }

    // Auto-reactivation logic for suspended users whose ban period has expired
    if (
      user.moderationStatus === 'suspended' &&
      user.bannedUntil &&
      user.bannedUntil <= new Date()
    ) {
      user.moderationStatus = 'active';
      user.isActive = true;
      user.bannedUntil = null;
      user.moderationHistory.push({
        action: 'unban',
        reason: 'Auto-reactivation: temporary ban expired',
        durationHours: 0,
        bannedUntil: null,
      });
      await user.save();
    }

    if (
      !user.isActive ||
      user.moderationStatus === 'banned' ||
      user.moderationStatus === 'suspended'
    ) {
      const err = new Error('Forbidden');
      err.status = 403;
      return next(err);
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { checkActive };
