const mongoose = require('mongoose');
const CommentLike = require('../models/comment-like.model');

const invalidIdError = () => {
  const err = new Error('Invalid id format');
  err.status = 400;
  return err;
};

const likeTarget = async (targetId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(targetId)) throw invalidIdError();
  try {
    await CommentLike.create({ target: targetId, user: userId });
  } catch (err) {
    if (err.code !== 11000) throw err; // already liked — idempotent
  }
  const likeCount = await CommentLike.countDocuments({ target: targetId });
  return { id: targetId, likeCount };
};

const unlikeTarget = async (targetId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(targetId)) throw invalidIdError();
  await CommentLike.findOneAndDelete({ target: targetId, user: userId });
  const likeCount = await CommentLike.countDocuments({ target: targetId });
  return { id: targetId, likeCount };
};

// Like counts + which targets the viewer liked, for a batch of comment/reply ids.
const getLikeData = async (targetIds, viewerId) => {
  if (targetIds.length === 0) {
    return { countById: new Map(), likedSet: new Set() };
  }
  const [agg, viewerLikes] = await Promise.all([
    CommentLike.aggregate([
      { $match: { target: { $in: targetIds } } },
      { $group: { _id: '$target', count: { $sum: 1 } } },
    ]),
    viewerId
      ? CommentLike.find({ target: { $in: targetIds }, user: viewerId }).select('target')
      : Promise.resolve([]),
  ]);
  return {
    countById: new Map(agg.map((row) => [row._id.toString(), row.count])),
    likedSet: new Set(viewerLikes.map((like) => like.target.toString())),
  };
};

module.exports = { likeTarget, unlikeTarget, getLikeData };
