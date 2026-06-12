const profileService = require('../services/profile.service');

const getProfile = async (req, res, next) => {
  try {
    const profile = await profileService.getProfile(req.params.id);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const profile = await profileService.updateProfile(req.user.sub, req.body);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

module.exports = { getProfile, updateProfile };
