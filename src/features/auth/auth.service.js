const bcrypt = require('bcryptjs');
const User = require('./user.model');

const register = async ({ username, email, password }) => {
  const passwordHash = await bcrypt.hash(password, 12);

  let user;
  try {
    user = await User.create({ username, email, passwordHash });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const error = new Error(`${field} already taken`);
      error.status = 409;
      throw error;
    }
    throw err;
  }

  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
};

module.exports = { register };
