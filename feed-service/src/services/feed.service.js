const Follow = require('../../../follow-service/src/models/follow.model');
const Post = require('../../../post-service/src/models/post.model');
const User = require('../../../auth-service/src/models/user.model');

const getFeed = async (userId, { limit = 20 } = {}) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  const followDocs = await Follow.find({ follower: userId }).select('following');
  const followingIds = followDocs.map((f) => f.following);

  if (followingIds.length === 0) {
    return [];
  }

  const posts = await Post.find({ author: { $in: followingIds } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('author', 'username isActive');

  return posts
    .filter((p) => p.author && p.author.isActive)
    .map((p) => ({
      id: p._id,
      content: p.content,
      author: { _id: p.author._id, username: p.author.username },
      createdAt: p.createdAt,
    }));
};

module.exports = { getFeed };
