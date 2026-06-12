const { Router } = require('express');
const { getProfile, updateProfile } = require('../../controllers/profile.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { validate, updateProfileSchema } = require('../../middlewares/validate');

const router = Router();

router.get('/:id', getProfile);
router.put('/me', authenticate, validate(updateProfileSchema), updateProfile);

module.exports = router;
