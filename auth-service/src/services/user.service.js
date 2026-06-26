const User = require('../models/user.model');
const mongoose = require('mongoose');

const moderateUser = async ({ userId, status, durationHours, reason, moderatorId }) => {
  // The admin UI targets users by username; accept either a Mongo id or username.
  const query = mongoose.Types.ObjectId.isValid(userId) ? { _id: userId } : { username: userId };

  const user = await User.findOne(query);
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
