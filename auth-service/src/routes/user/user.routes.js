const { Router } = require('express');
const accountRoutes = require('./user.account.routes');
const followRoutes = require('./user.follow.routes');

const router = Router();

router.use('/', accountRoutes);
router.use('/:id', followRoutes);

module.exports = router;
