const mongoose = require('mongoose');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');
const { applyCursorPagination } = require('../../../shared/utils/pagination');

const authServiceUrl = () => process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

// Mirror the follow edge into auth-service's User.following so follower counts
// and suggestions stay accurate there. Best-effort: a sync failure must not fail
// the follow action itself (the Follow collection is the source of truth).
const syncAuthFollowing = async (method, followerId, followingId) => {
  try {
    await fetch(`${authServiceUrl()}/internal/users/${followerId}/following/${followingId}`, {
      method,
    });
  } catch {
    /* ignore: counts will reconcile on the next successful sync */
  }
};

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

// The front addresses users by username in URLs; resolve to a Mongo id.
const resolveUserId = async (idOrUsername) => {
  if (mongoose.Types.ObjectId.isValid(idOrUsername)) {
    return idOrUsername;
  }

  let response;
  try {
    response = await fetch(
      `${authServiceUrl()}/internal/users/by-username/${encodeURIComponent(idOrUsername)}`
    );
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
  if (!user.id) {
    throw authServiceUnavailableError();
  }
  return user.id;
};

const upsertUserSnapshot = (user) =>
  User.findByIdAndUpdate(
    user.id,
    {
      $set: {
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl || '',
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
  displayName: user.displayName || user.username,
  avatarUrl: user.avatarUrl || '',
});

const followUser = async ({ followerId, followingId: followingParam }) => {
  const followingId = await resolveUserId(followingParam);
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
  await syncAuthFollowing('PUT', followerId, followingId);

  return { followerId, followingId };
};

const unfollowUser = async ({ followerId, followingId: followingParam }) => {
  const followingId = await resolveUserId(followingParam);
  await assertActiveUser(followerId);

  await Follow.findOneAndDelete({ follower: followerId, following: followingId });
  await User.findByIdAndUpdate(followerId, { $pull: { following: followingId } });
  await syncAuthFollowing('DELETE', followerId, followingId);

  return { followerId, followingId };
};

const getFollowers = async (idOrUsername, { cursor, limit = 50 } = {}) => {
  const userId = await resolveUserId(idOrUsername);

  const filter = { following: userId };
  const { data: follows, nextCursor, hasMore } = await applyCursorPagination(Follow, { cursor, limit, filter });

  const populated = await Follow.populate(follows, { path: 'follower', select: 'username displayName avatarUrl' });
  const data = populated.filter((follow) => follow.follower).map((follow) => toPublicUser(follow.follower));
  return { data, nextCursor, hasMore };
};

const getFollowing = async (idOrUsername, { cursor, limit = 50 } = {}) => {
  const userId = await resolveUserId(idOrUsername);

  const filter = { follower: userId };
  const { data: follows, nextCursor, hasMore } = await applyCursorPagination(Follow, { cursor, limit, filter });

  const populated = await Follow.populate(follows, { path: 'following', select: 'username displayName avatarUrl isActive' });
  const data = populated
    .filter((follow) => follow.following && follow.following.isActive !== false)
    .map((follow) => toPublicUser(follow.following));
  return { data, nextCursor, hasMore };
};

module.exports = { followUser, unfollowUser, getFollowers, getFollowing };
