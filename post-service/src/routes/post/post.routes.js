const { Router } = require('express');
const { likePost, unlikePost } = require('../../controllers/like.controller');
const {
  createPost,
  deletePost,
  getPost,
  getAllPosts,
  getTrends,
  getOwnPosts,
  getPostsByAuthors,
  getPostsByUser,
  searchPosts,
  updatePost,
} = require('../../controllers/post.controller');
const { authenticate } = require('../../middlewares/authenticate');
const { optionalAuth } = require('../../middlewares/optionalAuth');
const { validate, postContentSchema } = require('../../middlewares/validate');

/**
 * @openapi
 * components:
 *   schemas:
 *     CreatePostRequest:
 *       type: object
 *       required: [content]
 *       properties:
 *         content:
 *           type: string
 *           minLength: 1
 *           maxLength: 280
 *           example: This is a post on Breezy!
 *         mediaUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: http://localhost:3000/breezy-media/image.png
 *     PostResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 651a3c4d5e6f7a8b9c0d1e2f
 *         content:
 *           type: string
 *           example: This is a post on Breezy!
 *         authorId:
 *           type: string
 *           example: 651a2b3c4d5e6f7a8b9c0d1e
 *         mediaUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: http://localhost:3000/breezy-media/image.png
 *         likeCount:
 *           type: integer
 *           example: 5
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-06-12T13:00:00.000Z"
 *     PostLikeResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 651a3c4d5e6f7a8b9c0d1e2f
 *         likeCount:
 *           type: integer
 *           example: 6
 */

/**
 * @openapi
 * /posts:
 *   post:
 *     summary: Publish a new short post
 *     description: Publishes a short text post (1 to 280 characters). Only for active authenticated users.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostRequest'
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostResponse'
 *       400:
 *         description: Validation failed (empty content, whitespace-only, or > 280 characters)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Banned/Suspended user cannot post
 *
 * /posts/me:
 *   get:
 *     summary: Get list of own published posts
 *     description: Returns a list of posts published by the currently authenticated user.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PostResponse'
 *       401:
 *         description: Unauthorized
 *
 * /posts/user/{userId}:
 *   get:
 *     summary: Get list of posts published by a specific user
 *     tags: [Posts]
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: The ID of the user whose posts to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PostResponse'
 *       404:
 *         description: User not found
 *
 * /posts/{id}:
 *   put:
 *     summary: Update an existing post
 *     description: Edits the content of a post. Only the author can perform this action.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Post ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePostRequest'
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostResponse'
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only the author can edit this post
 *       404:
 *         description: Post not found
 *
 * /posts/{id}/like:
 *   post:
 *     summary: Like a post
 *     tags: [Likes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Post ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post liked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostLikeResponse'
 *       400:
 *         description: Invalid Post ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *       409:
 *         description: Already liked this post
 *   delete:
 *     summary: Unlike a post
 *     tags: [Likes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Post ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Post unliked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PostLikeResponse'
 *       400:
 *         description: Invalid Post ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 */

const router = Router();

router.get('/me', authenticate, getOwnPosts);
router.get('/all', optionalAuth, getAllPosts);
router.get('/trends', getTrends);
router.get('/search', optionalAuth, searchPosts);
router.get('/user/:userId', optionalAuth, getPostsByUser);
router.get('/', optionalAuth, getPostsByAuthors);
router.post('/', authenticate, validate(postContentSchema), createPost);
router.put('/:id', authenticate, validate(postContentSchema), updatePost);
router.post('/:id/like', authenticate, likePost);
router.delete('/:id/like', authenticate, unlikePost);
router.get('/:id', optionalAuth, getPost);
router.delete('/:id', authenticate, deletePost);

module.exports = router;
