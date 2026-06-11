const Comment = require('../models/comment.model');

const addComment = async ({ postId, content, authorId }) => {
  const comment = await Comment.create({ postId, content, author: authorId });
  return { id: comment._id, postId: comment.postId, content: comment.content, author: comment.author, createdAt: comment.createdAt };
};

const getComments = async (postId) => {
  const comments = await Comment.find({ postId }).sort({ createdAt: -1 });
  return comments.map((c) => ({ id: c._id, postId: c.postId, content: c.content, author: c.author, createdAt: c.createdAt }));
};

module.exports = { addComment, getComments };
