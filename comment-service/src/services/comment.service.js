const mongoose = require('mongoose');
const Comment = require('../models/comment.model');
const Reply = require('../models/reply.model');
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

const serializeComment = (comment, authors, replies = [], likes = emptyLikes) => ({
  id: comment._id.toString(),
  postId: comment.postId.toString(),
  content: comment.content,
  author: authorFor(authors, comment.author),
  likeCount: likes.countById.get(comment._id.toString()) ?? 0,
  isLiked: likes.likedSet.has(comment._id.toString()),
  replies,
  createdAt: comment.createdAt,
});

const addComment = async ({ postId, content, authorId }) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw invalidIdError();
  }

  const comment = await Comment.create({ postId, content, author: authorId });
  const authors = await fetchAuthorsByIds([comment.author]);
  return serializeComment(comment, authors);
};

const getComments = async (postId, { limit = 50, viewerId } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw invalidIdError();
  }

  const comments = await Comment.find({ postId }).sort({ createdAt: 1 }).limit(limit);
  const commentIds = comments.map((comment) => comment._id);
  const replies = await Reply.find({ commentId: { $in: commentIds } }).sort({ createdAt: 1 });

  // Batched lookups: authors + like data for every comment and reply.
  const authorIds = [...comments.map((c) => c.author), ...replies.map((r) => r.author)];
  const targetIds = [...commentIds, ...replies.map((r) => r._id)];
  const [authors, likes] = await Promise.all([
    fetchAuthorsByIds(authorIds),
    getLikeData(targetIds, viewerId),
  ]);

  const repliesByCommentId = new Map();
  replies.forEach((reply) => {
    const key = reply.commentId.toString();
    const list = repliesByCommentId.get(key) ?? [];
    list.push(serializeReply(reply, authors, likes));
    repliesByCommentId.set(key, list);
  });

  return comments.map((comment) =>
    serializeComment(comment, authors, repliesByCommentId.get(comment._id.toString()) ?? [], likes)
  );
};

const deleteComment = async ({ commentId, authorId }) => {
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw invalidIdError();
  }
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const err = new Error('Comment not found');
    err.status = 404;
    throw err;
  }
  if (comment.author.toString() !== authorId.toString()) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  const replies = await Reply.find({ commentId: comment._id }).select('_id');
  const likeTargets = [comment._id, ...replies.map((r) => r._id)];
  await CommentLike.deleteMany({ target: { $in: likeTargets } });
  await Reply.deleteMany({ commentId: comment._id });
  await comment.deleteOne();
};

// Total responses per post = top-level comments + their replies: { [postId]: count }.
const getCommentCounts = async (postIds = []) => {
  if (postIds.length === 0) return {};

  const comments = await Comment.find({ postId: { $in: postIds } }).select('_id postId');
  const counts = {};
  const commentToPost = new Map();
  for (const comment of comments) {
    counts[comment.postId] = (counts[comment.postId] || 0) + 1;
    commentToPost.set(comment._id.toString(), comment.postId);
  }

  if (comments.length > 0) {
    const replies = await Reply.find({
      commentId: { $in: comments.map((c) => c._id) },
    }).select('commentId');
    for (const reply of replies) {
      const postId = commentToPost.get(reply.commentId.toString());
      if (postId) counts[postId] = (counts[postId] || 0) + 1;
    }
  }

  return counts;
};

module.exports = { addComment, getComments, deleteComment, getCommentCounts };
