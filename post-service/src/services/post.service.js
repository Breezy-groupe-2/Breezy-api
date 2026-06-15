const mongoose = require('mongoose');
const Like = require('../models/like.model');
const Post = require('../models/post.model');

const postNotFoundError = (status = 404) => {
  const err = new Error('Post not found');
  err.status = status;
  return err;
};

const serializePost = async (post) => {
  const likeCount = await Like.countDocuments({ post: post._id });
  return {
    id: post._id,
    content: post.content,
    author: post.author,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likeCount,
  };
};

const createPost = async ({ content, authorId }) => {
  const post = await Post.create({ content, author: authorId });
  return serializePost(post);
};

const updatePost = async ({ postId, content, authorId }) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw postNotFoundError(400);
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw postNotFoundError();
  }
  if (post.author.toString() !== authorId.toString()) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  post.content = content;
  await post.save();
  return serializePost(post);
};

const getPostsByUser = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const posts = await Post.find({ author: userId }).sort({ createdAt: -1 });
  return Promise.all(posts.map((post) => serializePost(post)));
};

module.exports = { createPost, updatePost, getPostsByUser, postNotFoundError };
