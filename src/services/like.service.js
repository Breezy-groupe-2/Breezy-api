const Like = require('../models/like.model');
const Post = require('../models/post.model');

const likePost = async ({ postId, userId }) => {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error('Post not found');
    err.status = 404;
    throw err;
  }
  await Like.create({ post: postId, user: userId });
  const likeCount = await Like.countDocuments({ post: postId });
  return { postId, likeCount };
};

const unlikePost = async ({ postId, userId }) => {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error('Post not found');
    err.status = 404;
    throw err;
  }
  await Like.findOneAndDelete({ post: postId, user: userId });
  const likeCount = await Like.countDocuments({ post: postId });
  return { postId, likeCount };
};

module.exports = { likePost, unlikePost };
