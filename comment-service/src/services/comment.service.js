const mongoose = require('mongoose');
const Comment = require('../models/comment.model');
const Reply = require('../models/reply.model');

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

const addComment = async ({ postId, content, authorId }) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw invalidIdError();
  }

  const comment = await Comment.create({ postId, content, author: authorId });
  return {
    id: comment._id,
    postId: comment.postId,
    content: comment.content,
    author: serializeAuthor(comment.author),
    createdAt: comment.createdAt,
  };
};

const getComments = async (postId, { limit = 50 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw invalidIdError();
  }

  const comments = await Comment.find({ postId }).sort({ createdAt: 1 }).limit(limit);
  const repliesByCommentId = new Map();
  const commentIds = comments.map((comment) => comment._id);
  const replies = await Reply.find({ commentId: { $in: commentIds } }).sort({ createdAt: 1 });

  replies.forEach((reply) => {
    const key = reply.commentId.toString();
    const commentReplies = repliesByCommentId.get(key) ?? [];
    commentReplies.push(serializeReply(reply));
    repliesByCommentId.set(key, commentReplies);
  });

  return comments.map((c) => ({
    id: c._id,
    postId: c.postId,
    content: c.content,
    author: serializeAuthor(c.author),
    createdAt: c.createdAt,
    replies: repliesByCommentId.get(c._id.toString()) ?? [],
  }));
};

module.exports = { addComment, getComments };
