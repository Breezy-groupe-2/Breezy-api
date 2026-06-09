const { Router } = require('express');
const { createPost, updatePost } = require('../../controllers/post.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { validate, createPostSchema } = require('../../middlewares/validate');

const router = Router();

router.post('/', authenticate, validate(createPostSchema), createPost);
router.put('/:id', authenticate, validate(createPostSchema), updatePost);

module.exports = router;
