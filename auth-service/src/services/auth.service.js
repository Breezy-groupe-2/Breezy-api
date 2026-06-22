const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { env } = require('../config/env');
const { defaultThemePreferences } = require('../config/theme-preferences');

const signToken = (user) =>
  jwt.sign({ sub: user._id, role: user.role }, env.jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

const normalizePreferences = (preferences) => ({
  theme: {
    mode: preferences?.theme?.mode ?? defaultThemePreferences.mode,
    accentColor: preferences?.theme?.accentColor ?? defaultThemePreferences.accentColor,
  },
});

const toPublicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  preferences: normalizePreferences(user.preferences),
});

const checkUserStatus = async (user) => {
  if (user.moderationStatus === 'suspended' && user.bannedUntil && user.bannedUntil <= new Date()) {
    user.moderationStatus = 'active';
    user.isActive = true;
    user.bannedUntil = null;
    user.moderationHistory.push({
      action: 'unban',
      reason: 'Auto-reactivation: temporary ban expired',
      durationHours: 0,
      bannedUntil: null,
    });
    await user.save();
  }

  if (
    !user.isActive ||
    user.moderationStatus === 'banned' ||
    user.moderationStatus === 'suspended'
  ) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
};

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
    token: signToken(user),
    user: { ...toPublicUser(user), createdAt: user.createdAt },
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    const err = new Error('Invalid credentials');
    err.status = 401;
    throw err;
  }

  await checkUserStatus(user);

  const token = signToken(user);
  return { token, user: toPublicUser(user) };
};

const getMe = async (userId) => {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return toPublicUser(user);
};

const updatePreferences = async (userId, preferences) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  user.preferences = {
    theme: preferences.theme,
  };

  await user.save();

  return normalizePreferences(user.preferences);
};

module.exports = { register, login, getMe, updatePreferences };
