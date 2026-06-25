const feedService = require('../services/feed.service');

const parseLimit = (queryLimit) => {
  if (queryLimit === undefined) {
    return 20;
  }

  const limit = Number(queryLimit);
  if (!Number.isInteger(limit)) {
    const err = new Error('limit must be an integer');
    err.status = 400;
    throw err;
  }

  return Math.min(Math.max(limit, 1), 100);
};

const getFeed = async (req, res, next) => {
  try {
    const limit = parseLimit(req.query.limit);
    const posts = await feedService.getFeed(req.user.sub, {
      authorization: req.headers.authorization,
      limit,
    });
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
};

module.exports = { getFeed, parseLimit };
