const likeService = require('../services/like.service');

const likePost = async (req, res, next) => {
  try {
    const result = await likeService.likePost({ postId: req.params.id, userId: req.user.sub });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const unlikePost = async (req, res, next) => {
  try {
    const result = await likeService.unlikePost({ postId: req.params.id, userId: req.user.sub });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { likePost, unlikePost };
