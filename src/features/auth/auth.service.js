const bcrypt = require('bcryptjs');
const User = require('./user.model');

const register = async ({ username, email, password }) => {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, email, passwordHash });
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
};

module.exports = { register };
