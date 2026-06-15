const userService = require('../services/user.service');

const moderateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, durationHours, reason } = req.body;
    const moderatorId = req.user.sub;

    const result = await userService.moderateUser({
      userId: id,
      status,
      durationHours,
      reason,
      moderatorId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { moderateUser };
