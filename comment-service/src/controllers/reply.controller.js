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
    const replies = await replyService.getReplies(req.params.commentId);
    res.status(200).json(replies);
  } catch (err) {
    next(err);
  }
};

module.exports = { addReply, getReplies };
