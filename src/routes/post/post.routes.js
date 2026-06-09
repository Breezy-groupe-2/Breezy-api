const { Router } = require('express');
const { createPost } = require('../../controllers/post.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { validate, createPostSchema } = require('../../middlewares/validate');

const router = Router();

router.post('/', authenticate, validate(createPostSchema), createPost);

module.exports = router;
