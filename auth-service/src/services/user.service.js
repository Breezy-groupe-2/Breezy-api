const User = require('../models/user.model');
const mongoose = require('mongoose');

const moderateUser = async ({ userId, status, durationHours, reason, moderatorId }) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  let bannedUntil = null;
  let isActive = true;
  let action = 'unban';

  if (status === 'suspended') {
    action = 'suspend';
    isActive = false;
    if (durationHours && durationHours > 0) {
      bannedUntil = new Date(Date.now() + durationHours * 3600 * 1000);
    }
  } else if (status === 'banned') {
    action = 'ban';
    isActive = false;
  }

  user.moderationStatus = status;
  user.isActive = isActive;
  user.bannedUntil = bannedUntil;

  user.moderationHistory.push({
    action,
    reason,
    durationHours,
    bannedUntil,
    moderatedBy: moderatorId,
  });

  await user.save();

  return {
    id: user._id.toString(),
    username: user.username,
    moderationStatus: user.moderationStatus,
    bannedUntil: user.bannedUntil,
  };
};

module.exports = { moderateUser };
