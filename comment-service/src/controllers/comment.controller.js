const commentService = require('../services/comment.service');

const addComment = async (req, res, next) => {
  try {
    const comment = await commentService.addComment({
      postId: req.params.postId,
      content: req.body.content,
      authorId: req.user.sub,
    });
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
};

const getComments = async (req, res, next) => {
  try {
    const comments = await commentService.getComments(req.params.postId, {
      viewerId: req.viewerId,
    });
    res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    await commentService.deleteComment({
      commentId: req.params.commentId,
      authorId: req.user.sub,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const getCommentCounts = async (req, res, next) => {
  try {
    const postIds = (req.query.postIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const counts = await commentService.getCommentCounts(postIds);
    res.status(200).json(counts);
  } catch (err) {
    next(err);
  }
};

module.exports = { addComment, getComments, deleteComment, getCommentCounts };
