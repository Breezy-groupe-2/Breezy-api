const mongoose = require('mongoose');
const Profile = require('../models/profile.model');

const getProfile = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const profile = await Profile.findOne({ userId });

  return {
    userId,
    bio: profile?.bio ?? '',
    avatar: profile?.avatar ?? '',
  };
};

const getOwnProfile = async (userId, user) => {
  const profile = await Profile.findOne({ userId });

  return {
    id: userId,
    username: user.username,
    email: user.email,
    bio: profile?.bio ?? '',
    avatar: profile?.avatar ?? '',
  };
};

const updateProfile = async (userId, { bio, avatar }) => {
  const update = {};
  if (bio !== undefined) update.bio = bio;
  if (avatar !== undefined) update.avatar = avatar;

  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );

  return {
    userId: profile.userId,
    bio: profile.bio,
    avatar: profile.avatar,
  };
};

module.exports = { getProfile, getOwnProfile, updateProfile };
