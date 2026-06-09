const { Router } = require('express');
const { getFeed } = require('../../controllers/feed.controller');
const { authenticate } = require('../../middlewares/authenticate');

const router = Router();

router.get('/', authenticate, getFeed);

module.exports = router;
