const bcrypt = require('bcryptjs');
const { UniqueConstraintError } = require('sequelize');
const User = require('../models/User');

const register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password_hash });

    return res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const field = err.errors[0]?.path;
      return res.status(409).json({ error: `${field} already taken` });
    }
    throw err;
  }
};

module.exports = { register };
