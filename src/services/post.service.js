const Post = require('../models/post.model');

const createPost = async ({ content, authorId }) => {
  const post = await Post.create({ content, author: authorId });
  return { id: post._id, content: post.content, author: post.author, createdAt: post.createdAt };
};

module.exports = { createPost };
