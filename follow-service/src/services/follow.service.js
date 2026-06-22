const mongoose = require('mongoose');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');

const authServiceUrl = () => process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

const userNotFoundError = () => {
  const err = new Error('User not found');
  err.status = 404;
  return err;
};

const authServiceUnavailableError = () => {
  const err = new Error('Auth service unavailable');
  err.status = 502;
  return err;
};

const assertValidUserId = (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw userNotFoundError();
  }
};

const fetchAuthUser = async (userId) => {
  let response;
  try {
    response = await fetch(`${authServiceUrl()}/internal/users/${userId}`);
  } catch {
    throw authServiceUnavailableError();
  }

  if (response.status === 404) {
    throw userNotFoundError();
  }
  if (!response.ok) {
    throw authServiceUnavailableError();
  }

  const user = await response.json();
  if (!user.id || !user.username) {
    throw authServiceUnavailableError();
  }

  return user;
};

const upsertUserSnapshot = (user) =>
  User.findByIdAndUpdate(
    user.id,
    {
      $set: {
        username: user.username,
        email: `${user.id}@internal.breezy.local`,
        passwordHash: 'external-auth-user',
        isActive: user.isActive !== false,
      },
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );

const findUserSnapshot = async (userId) => {
  assertValidUserId(userId);

  const localUser = await User.findById(userId);
  if (localUser) {
    return localUser;
  }

  return upsertUserSnapshot(await fetchAuthUser(userId));
};

const assertActiveUser = async (userId) => {
  const user = await findUserSnapshot(userId);
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
  await findUserSnapshot(followingId);

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
