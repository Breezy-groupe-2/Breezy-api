const followService = require('../services/follow.service');

const followUser = async (req, res, next) => {
  try {
    const result = await followService.followUser({
      followerId: req.user.sub,
      followingId: req.params.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const unfollowUser = async (req, res, next) => {
  try {
    const result = await followService.unfollowUser({
      followerId: req.user.sub,
      followingId: req.params.id,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const getFollowers = async (req, res, next) => {
  try {
    const followers = await followService.getFollowers(req.params.id);
    res.status(200).json(followers);
  } catch (err) {
    next(err);
  }
};

const getFollowing = async (req, res, next) => {
  try {
    const following = await followService.getFollowing(req.params.id);
    res.status(200).json(following);
  } catch (err) {
    next(err);
  }
};

module.exports = { followUser, unfollowUser, getFollowers, getFollowing };
