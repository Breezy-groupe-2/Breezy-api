const { Router } = require('express');
const accountRoutes = require('./user.account.routes');

const router = Router();

router.use('/', accountRoutes);

module.exports = router;
