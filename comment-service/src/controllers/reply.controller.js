const replyService = require('../services/reply.service');

const addReply = async (req, res, next) => {
  try {
    const reply = await replyService.addReply({
      commentId: req.params.commentId,
      content: req.body.content,
      authorId: req.user.sub,
    });
    res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
};

const getReplies = async (req, res, next) => {
  try {
    const replies = await replyService.getReplies(req.params.commentId, {
      viewerId: req.viewerId,
    });
    res.status(200).json(replies);
  } catch (err) {
    next(err);
  }
};

const deleteReply = async (req, res, next) => {
  try {
    await replyService.deleteReply({
      replyId: req.params.replyId,
      authorId: req.user.sub,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { addReply, getReplies, deleteReply };
