const User = require('../models/user.model');

const getProfile = async (userId) => {
  const user = await User.findById(userId).select('-passwordHash -following');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return { id: user._id, username: user.username, email: user.email, bio: user.bio, avatar: user.avatar, role: user.role, createdAt: user.createdAt };
};

const updateProfile = async (userId, { bio, avatar }) => {
  const user = await User.findByIdAndUpdate(userId, { bio, avatar }, { new: true, runValidators: true }).select('-passwordHash -following');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return { id: user._id, username: user.username, email: user.email, bio: user.bio, avatar: user.avatar, role: user.role };
};

module.exports = { getProfile, updateProfile };
