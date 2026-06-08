const User = require('../models/user.model');

const register = async ({ username, email, password }) => {
  const user = await User.create({ username, email, passwordHash: password });
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
};

module.exports = { register };
