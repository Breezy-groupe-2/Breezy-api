const { Router } = require('express');
const { likePost, unlikePost } = require('../../controllers/like.controller');
const {
  createPost,
  getOwnPosts,
  getPostsByUser,
  updatePost,
} = require('../../controllers/post.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { validate, postContentSchema } = require('../../middlewares/validate');

const router = Router();

router.get('/me', authenticate, getOwnPosts);
router.get('/user/:userId', getPostsByUser);
router.post('/', authenticate, validate(postContentSchema), createPost);
router.put('/:id', authenticate, validate(postContentSchema), updatePost);
router.post('/:id/like', authenticate, likePost);
router.delete('/:id/like', authenticate, unlikePost);

module.exports = router;
