const Post = require('../models/post.model');
const User = require('../models/user.model');

const getFeed = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .populate('author', 'username');
  return posts.map((p) => ({ id: p._id, content: p.content, author: p.author, createdAt: p.createdAt }));
};

module.exports = { getFeed };
