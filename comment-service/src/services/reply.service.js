const mongoose = require('mongoose');
const Reply = require('../models/reply.model');
const Comment = require('../models/comment.model');
const CommentLike = require('../models/comment-like.model');
const { fetchAuthorsByIds, authorFor } = require('../utils/users');
const { getLikeData } = require('../utils/likes');

const invalidIdError = () => {
  const err = new Error('Invalid id format');
  err.status = 400;
  return err;
};

const emptyLikes = { countById: new Map(), likedSet: new Set() };

const serializeReply = (reply, authors, likes = emptyLikes) => ({
  id: reply._id.toString(),
  parentId: reply.commentId.toString(),
  parentCommentId: reply.commentId.toString(),
  commentId: reply.commentId.toString(),
  content: reply.content,
  author: authorFor(authors, reply.author),
  likeCount: likes.countById.get(reply._id.toString()) ?? 0,
  isLiked: likes.likedSet.has(reply._id.toString()),
  replies: [],
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
  const authors = await fetchAuthorsByIds([reply.author]);
  return serializeReply(reply, authors);
};

const getReplies = async (commentId, { limit = 50, viewerId } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw invalidIdError();
  }

  const replies = await Reply.find({ commentId }).sort({ createdAt: 1 }).limit(limit);
  const [authors, likes] = await Promise.all([
    fetchAuthorsByIds(replies.map((reply) => reply.author)),
    getLikeData(replies.map((reply) => reply._id), viewerId),
  ]);
  return replies.map((reply) => serializeReply(reply, authors, likes));
};

const deleteReply = async ({ replyId, authorId }) => {
  if (!mongoose.Types.ObjectId.isValid(replyId)) {
    throw invalidIdError();
  }
  const reply = await Reply.findById(replyId);
  if (!reply) {
    const err = new Error('Reply not found');
    err.status = 404;
    throw err;
  }
  if (reply.author.toString() !== authorId.toString()) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  await CommentLike.deleteMany({ target: reply._id });
  await reply.deleteOne();
};

module.exports = { addReply, getReplies, deleteReply };
