const Follow = require('../models/follow.model');

const followUser = async ({ followerId, followingId }) => {
  if (followerId.toString() === followingId.toString()) {
    const err = new Error('Cannot follow yourself');
    err.status = 400;
    throw err;
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
  return { followerId, followingId };
};

const unfollowUser = async ({ followerId, followingId }) => {
  await Follow.findOneAndDelete({ follower: followerId, following: followingId });
  return { followerId, followingId };
};

const getFollowers = async (userId) => {
  const follows = await Follow.find({ following: userId }).populate('follower', 'username email');
  return follows.map((f) => ({ id: f.follower._id, username: f.follower.username, email: f.follower.email }));
};

const getFollowing = async (userId) => {
  const follows = await Follow.find({ follower: userId }).populate('following', 'username email');
  return follows.map((f) => ({ id: f.following._id, username: f.following.username, email: f.following.email }));
};

module.exports = { followUser, unfollowUser, getFollowers, getFollowing };
