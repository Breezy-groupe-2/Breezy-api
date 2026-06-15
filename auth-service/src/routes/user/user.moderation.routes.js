const { Router } = require('express');
const { moderateUser } = require('../../controllers/user.controller');
const { validate, moderationSchema } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { requireRole } = require('../../middlewares/authorize');
const { checkActive } = require('../../middlewares/checkActive');

const router = Router();

router.patch(
  '/:id/moderation',
  authenticate,
  checkActive,
  requireRole(['moderator', 'admin']),
  validate(moderationSchema),
  moderateUser
);

module.exports = router;
