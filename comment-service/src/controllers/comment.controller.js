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
    const comments = await commentService.getComments(req.params.postId);
    res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
};

module.exports = { addComment, getComments };
