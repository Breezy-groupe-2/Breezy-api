const bcrypt = require('bcryptjs');
const User = require('../models/User');

const register = async (req, res) => {
  const { username, email, password } = req.body;

  const password_hash = await bcrypt.hash(password, 12);
  const user = await User.create({ username, email, password_hash });

  res.status(201).json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  });
};

module.exports = { register };
