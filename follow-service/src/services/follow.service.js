const mongoose = require('mongoose');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');

const userNotFoundError = () => {
  const err = new Error('User not found');
  err.status = 404;
  return err;
};

const assertValidUserId = (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw userNotFoundError();
  }
};

const assertActiveUser = async (userId) => {
  assertValidUserId(userId);

  const user = await User.findById(userId);
  if (!user) {
    throw userNotFoundError();
  }
  if (!user.isActive) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return user;
};

const toPublicUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
});

const followUser = async ({ followerId, followingId }) => {
  assertValidUserId(followingId);
  if (followerId.toString() === followingId.toString()) {
    const err = new Error('Cannot follow yourself');
    err.status = 400;
    throw err;
  }

  await assertActiveUser(followerId);
  const followingUser = await User.findById(followingId);
  if (!followingUser) {
    throw userNotFoundError();
  }

  try {
    await Follow.create({ follower: followerId, following: followingId });
  } catch (err) {
    if (err.code === 11000) {
      const conflict = new Error('Already following');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }

  await User.findByIdAndUpdate(followerId, { $addToSet: { following: followingId } });

  return { followerId, followingId };
};

const unfollowUser = async ({ followerId, followingId }) => {
  assertValidUserId(followingId);
  await assertActiveUser(followerId);

  await Follow.findOneAndDelete({ follower: followerId, following: followingId });
  await User.findByIdAndUpdate(followerId, { $pull: { following: followingId } });

  return { followerId, followingId };
};

const getFollowers = async (userId) => {
  assertValidUserId(userId);

  const follows = await Follow.find({ following: userId }).populate('follower', 'username');

  return follows.filter((follow) => follow.follower).map((follow) => toPublicUser(follow.follower));
};

const getFollowing = async (userId) => {
  assertValidUserId(userId);

  const follows = await Follow.find({ follower: userId }).populate('following', 'username isActive');

  return follows
    .filter((follow) => follow.following && follow.following.isActive !== false)
    .map((follow) => toPublicUser(follow.following));
};

module.exports = { followUser, unfollowUser, getFollowers, getFollowing };
