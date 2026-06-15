const feedService = require('../services/feed.service');

const getFeed = async (req, res, next) => {
  try {
    const posts = await feedService.getFeed(req.user.sub, {
      authorization: req.headers.authorization,
    });
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
};

module.exports = { getFeed };
