const mongoose = require('mongoose');
const Profile = require('../models/profile.model');

const toPublicProfile = (profile, userId) => ({
  userId,
  bio: profile?.bio ?? '',
  avatarUrl: profile?.avatar ?? '',
});

const getProfile = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const profile = await Profile.findOne({ userId });

  return toPublicProfile(profile, userId);
};

const getOwnProfile = async (userId, user) => {
  const profile = await Profile.findOne({ userId });

  return {
    id: userId,
    username: user.username,
    email: user.email,
    bio: profile?.bio ?? '',
    avatarUrl: profile?.avatar ?? '',
  };
};

const updateProfile = async (userId, { bio, avatarUrl }) => {
  const update = {};
  if (bio !== undefined) update.bio = bio;
  if (avatarUrl !== undefined) update.avatar = avatarUrl;

  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );

  return toPublicProfile(profile, profile.userId);
};

module.exports = { getProfile, getOwnProfile, updateProfile };
