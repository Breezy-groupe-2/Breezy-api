const mongoose = require('mongoose');
const Reply = require('../models/reply.model');
const Comment = require('../models/comment.model');

const invalidIdError = () => {
  const err = new Error('Invalid id format');
  err.status = 400;
  return err;
};

const serializeAuthor = (author) => ({ id: author.toString() });

const serializeReply = (reply) => ({
  id: reply._id,
  commentId: reply.commentId,
  content: reply.content,
  author: serializeAuthor(reply.author),
  createdAt: reply.createdAt,
});

const addReply = async ({ commentId, content, authorId }) => {
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw invalidIdError();
  }

  const comment = await Comment.findById(commentId);
  if (!comment) {
    const err = new Error('Comment not found');
    err.status = 404;
    throw err;
  }
  const reply = await Reply.create({ commentId, content, author: authorId });
  return serializeReply(reply);
};

const getReplies = async (commentId, { limit = 50 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw invalidIdError();
  }

  const replies = await Reply.find({ commentId }).sort({ createdAt: 1 }).limit(limit);
  return replies.map(serializeReply);
};

module.exports = { addReply, getReplies };
