const { likeTarget, unlikeTarget } = require('../utils/likes');

// `id` is the comment OR reply id (both are unique ObjectIds).
const likeComment = async (req, res, next) => {
  try {
    const result = await likeTarget(req.params.id, req.user.sub);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const unlikeComment = async (req, res, next) => {
  try {
    const result = await unlikeTarget(req.params.id, req.user.sub);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { likeComment, unlikeComment };
