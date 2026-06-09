const { Router } = require('express');
const { createPost } = require('../../controllers/post.controller');
const { authenticate } = require('../../middlewares/authenticate');

const router = Router();

router.post('/', authenticate, createPost);

module.exports = router;
