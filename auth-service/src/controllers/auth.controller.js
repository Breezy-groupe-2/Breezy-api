const authService = require('../services/auth.service');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const googleLogin = async (req, res, next) => {
  try {
    const result = await authService.loginWithGoogle(req.body);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.sub);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

const updatePreferences = async (req, res, next) => {
  try {
    const preferences = await authService.updatePreferences(req.user.sub, req.body);
    res.status(200).json(preferences);
  } catch (err) {
    next(err);
  }
};

const internalUserSummary = async (req, res, next) => {
  try {
    const user = await authService.getInternalUserSummary(req.params.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

const syncFollowing = async (req, res, next) => {
  try {
    await authService.addFollowing(req.params.followerId, req.params.followingId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const syncUnfollowing = async (req, res, next) => {
  try {
    await authService.removeFollowing(req.params.followerId, req.params.followingId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const internalUserByUsername = async (req, res, next) => {
  try {
    const user = await authService.getInternalUserByUsername(req.params.username);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

const internalUsersByIds = async (req, res, next) => {
  try {
    const ids = (req.query.ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const users = await authService.getInternalUsersByIds(ids);
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};

const getSuggestions = async (req, res, next) => {
  try {
    const users = await authService.getSuggestions(req.user.sub);
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};

const getPublicUser = async (req, res, next) => {
  try {
    const user = await authService.getPublicUser(req.params.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const user = await authService.updateOwnProfile(req.user.sub, req.body);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  me,
  getSuggestions,
  getPublicUser,
  updateMe,
  internalUserSummary,
  internalUserByUsername,
  internalUsersByIds,
  syncFollowing,
  syncUnfollowing,
  updatePreferences,
};
