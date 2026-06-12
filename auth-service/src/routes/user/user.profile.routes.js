const { Router } = require('express');
const { getProfile, updateProfile } = require('../../controllers/profile.controller');
const { authenticate } = require('../../middlewares/authenticate');

const router = Router();

router.get('/:id', getProfile);
router.put('/me', authenticate, updateProfile);

module.exports = router;
