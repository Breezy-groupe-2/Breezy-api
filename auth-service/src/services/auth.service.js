const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
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

// Canonical public user shape consumed by the front-end. followersCount is
// derived from how many users have this id in their `following` array.
const toPublicUser = async (user) => {
  const followersCount = await User.countDocuments({ following: user._id });
  return {
    id: user._id.toString(),
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email,
    bio: user.bio || '',
    avatarUrl: user.avatarUrl || '',
    bannerUrl: user.bannerUrl || '',
    role: user.role,
    isAdmin: ['admin', 'moderator'].includes(user.role),
    status: user.moderationStatus,
    followersCount,
    followingCount: user.following?.length ?? 0,
    createdAt: user.createdAt,
    preferences: normalizePreferences(user.preferences),
  };
};

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
    user: await toPublicUser(user),
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
  return { token, user: await toPublicUser(user) };
};

const deriveUniqueUsername = async (rawBase) => {
  let base = (rawBase || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40);
  if (base.length < 3) {
    base = `${base}user`;
  }
  let username = base;
  let suffix = 0;
  // Append an incrementing suffix until we find a free username.
  while (await User.exists({ username })) {
    suffix += 1;
    username = `${base}${suffix}`;
  }
  return username;
};

const loginWithGoogle = async ({ credential }) => {
  if (!env.googleClientId) {
    const err = new Error('Google sign-in is not configured');
    err.status = 503;
    throw err;
  }

  // Lazy-load so the dependency is only required when Google is configured.
  const { OAuth2Client } = require('google-auth-library');
  const client = new OAuth2Client(env.googleClientId);

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    const err = new Error('Invalid Google credential');
    err.status = 401;
    throw err;
  }

  if (!payload?.email || payload.email_verified === false) {
    const err = new Error('Google account email is not verified');
    err.status = 401;
    throw err;
  }

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ email });

  if (!user) {
    // Google accounts never log in with a password; store an unusable random hash.
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 12);
    const username = await deriveUniqueUsername(payload.email.split('@')[0]);
    user = await User.create({ username, email, passwordHash });
  }

  await checkUserStatus(user);

  return { token: signToken(user), user: await toPublicUser(user) };
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

// Public profile lookup by Mongo id OR username (the front uses usernames in URLs).
const getPublicUser = async (idOrUsername) => {
  const query = mongoose.Types.ObjectId.isValid(idOrUsername)
    ? { _id: idOrUsername }
    : { username: idOrUsername };
  const user = await User.findOne(query).select('-passwordHash');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return toPublicUser(user);
};

// Follow graph is owned by follow-service; it keeps auth's User.following in
// sync (via the internal endpoints below) so follower counts and suggestions
// stay accurate.
const addFollowing = (followerId, followingId) =>
  User.findByIdAndUpdate(followerId, { $addToSet: { following: followingId } });

const removeFollowing = (followerId, followingId) =>
  User.findByIdAndUpdate(followerId, { $pull: { following: followingId } });

// Active users the viewer does not already follow (and not themselves).
const getSuggestions = async (viewerId, limit = 5) => {
  const me = await User.findById(viewerId).select('following');
  const exclude = [viewerId, ...(me?.following ?? [])];
  const users = await User.find({
    _id: { $nin: exclude },
    moderationStatus: 'active',
    isActive: true,
  }).limit(limit);
  return Promise.all(users.map((user) => toPublicUser(user)));
};

// Case-insensitive lookup by username or display name (active users only,
// excluding the viewer). Used by the "Discover" search page.
const searchUsers = async (rawQuery, viewerId, limit = 10) => {
  const query = (rawQuery || '').trim();
  if (!query) return [];
  // Escape regex metacharacters so the query is treated as plain text.
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(safe, 'i');
  const users = await User.find({
    _id: { $ne: viewerId },
    moderationStatus: 'active',
    isActive: true,
    $or: [{ username: regex }, { displayName: regex }],
  }).limit(limit);
  return Promise.all(users.map((user) => toPublicUser(user)));
};

const updateOwnProfile = async (userId, { displayName, bio, avatarUrl, bannerUrl }) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  if (displayName !== undefined) user.displayName = displayName;
  if (bio !== undefined) user.bio = bio;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (bannerUrl !== undefined) user.bannerUrl = bannerUrl;
  await user.save();
  return toPublicUser(user);
};

// Lightweight summary used by sibling services to enrich author references.
const internalUserShape = (user) => ({
  id: user._id.toString(),
  username: user.username,
  displayName: user.displayName || user.username,
  avatarUrl: user.avatarUrl || '',
  bannerUrl: user.bannerUrl || '',
  isActive: user.isActive,
});

const getInternalUserSummary = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  const user = await User.findById(userId).select(
    'username displayName avatarUrl bannerUrl isActive'
  );
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return internalUserShape(user);
};

const getInternalUserByUsername = async (username) => {
  const user = await User.findOne({ username }).select(
    'username displayName avatarUrl bannerUrl isActive'
  );
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }
  return internalUserShape(user);
};

// Batch resolution: a single query for many ids (avoids per-author HTTP fan-out
// in sibling services). Unknown/invalid ids are simply omitted from the result.
const getInternalUsersByIds = async (ids) => {
  const valid = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (valid.length === 0) return [];
  const users = await User.find({ _id: { $in: valid } }).select(
    'username displayName avatarUrl bannerUrl isActive'
  );
  return users.map(internalUserShape);
};

const updatePreferences = async (userId, preferences) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  user.preferences.theme = preferences.theme;

  await user.save();

  return normalizePreferences(user.preferences);
};

module.exports = {
  register,
  login,
  loginWithGoogle,
  getMe,
  getPublicUser,
  getSuggestions,
  searchUsers,
  addFollowing,
  removeFollowing,
  updateOwnProfile,
  getInternalUserSummary,
  getInternalUserByUsername,
  getInternalUsersByIds,
  updatePreferences,
};
