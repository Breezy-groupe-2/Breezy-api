const Reply = require('../models/reply.model');
const Comment = require('../models/comment.model');

const addReply = async ({ commentId, content, authorId }) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const err = new Error('Comment not found');
    err.status = 404;
    throw err;
  }
  const reply = await Reply.create({ commentId, content, author: authorId });
  return { id: reply._id, commentId: reply.commentId, content: reply.content, author: reply.author, createdAt: reply.createdAt };
};

const getReplies = async (commentId, { limit = 50 } = {}) => {
  const replies = await Reply.find({ commentId }).sort({ createdAt: 1 }).limit(limit);
  return replies.map((r) => ({ id: r._id, commentId: r.commentId, content: r.content, author: r.author, createdAt: r.createdAt }));
};

module.exports = { addReply, getReplies };
