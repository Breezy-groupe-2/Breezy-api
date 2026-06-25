const mongoose = require('mongoose');
const Like = require('../models/like.model');
const Post = require('../models/post.model');
const { postNotFoundError } = require('./post.service');

const ensurePostExists = async (postId) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw postNotFoundError(400);
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw postNotFoundError();
  }
};

const likePost = async ({ postId, userId }) => {
  await ensurePostExists(postId);

  try {
    await Like.create({ post: postId, user: userId });
  } catch (err) {
    if (err.code === 11000) {
      const conflict = new Error('Already liked');
      conflict.status = 409;
      throw conflict;
    }
    throw err;
  }

  const likeCount = await Like.countDocuments({ post: postId });
  return { postId, likeCount };
};

const unlikePost = async ({ postId, userId }) => {
  await ensurePostExists(postId);
  await Like.findOneAndDelete({ post: postId, user: userId });
  const likeCount = await Like.countDocuments({ post: postId });
  return { postId, likeCount };
};

module.exports = { likePost, unlikePost };
