const Post = require('../models/post.model');
const Like = require('../models/like.model');

const createPost = async ({ content, authorId }) => {
  const post = await Post.create({ content, author: authorId });
  return {
    id: post._id,
    content: post.content,
    author: post.author,
    createdAt: post.createdAt,
    likeCount: 0,
  };
};

const updatePost = async ({ postId, content, authorId }) => {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error('Post not found');
    err.status = 404;
    throw err;
  }
  if (post.author.toString() !== authorId.toString()) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  post.content = content;
  await post.save();
  const likeCount = await Like.countDocuments({ post: post._id });
  return {
    id: post._id,
    content: post.content,
    author: post.author,
    updatedAt: post.updatedAt,
    likeCount,
  };
};

module.exports = { createPost, updatePost };
