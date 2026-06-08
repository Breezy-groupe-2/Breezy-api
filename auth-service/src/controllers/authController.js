const User = require('../models/User');
const sequelize = require('../config/database');

const register = async (req, res) => {
  const { username, email, password } = req.body;

  const user = await User.create({ username, email, password_hash: password });

  res.status(201).json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  });
};

module.exports = { register };
