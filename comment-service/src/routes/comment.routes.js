const { Router } = require('express');
const { addComment, getComments } = require('../controllers/comment.controller');
const { authenticate } = require('../middlewares/authenticate');
const { contentSchema, validate } = require('../middlewares/validate');

/**
 * @openapi
 * components:
 *   schemas:
 *     CreateCommentRequest:
 *       type: object
 *       required: [content]
 *       properties:
 *         content:
 *           type: string
 *           minLength: 1
 *           maxLength: 280
 *           example: Great post!
 *     CommentResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 651a4d5e6f7a8b9c0d1e2f3a
 *         postId:
 *           type: string
 *           example: 651a3c4d5e6f7a8b9c0d1e2f
 *         content:
 *           type: string
 *           example: Great post!
 *         authorId:
 *           type: string
 *           example: 651a2b3c4d5e6f7a8b9c0d1e
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-06-12T13:05:00.000Z"
 *         replies:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReplyResponse'
 *     ReplyResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 651a5e6f7a8b9c0d1e2f3a4b
 *         parentCommentId:
 *           type: string
 *           example: 651a4d5e6f7a8b9c0d1e2f3a
 *         content:
 *           type: string
 *           example: Agreed!
 *         authorId:
 *           type: string
 *           example: 651a3b4c5d6e7f8a9b0c1d2e
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-06-12T13:06:00.000Z"
 */

/**
 * @openapi
 * /posts/{postId}/comments:
 *   post:
 *     summary: Comment on a post
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: postId
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
 *             $ref: '#/components/schemas/CreateCommentRequest'
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CommentResponse'
 *       400:
 *         description: Validation failed (empty, or > 280 characters)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Post not found
 *   get:
 *     summary: List comments of a post
 *     description: Retrieves comments in chronological order.
 *     tags: [Comments]
 *     parameters:
 *       - name: postId
 *         in: path
 *         required: true
 *         description: Post ID
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
 *                 $ref: '#/components/schemas/CommentResponse'
 *       404:
 *         description: Post not found
 */

const router = Router({ mergeParams: true });

router.post('/', authenticate, validate(contentSchema), addComment);
router.get('/', getComments);

module.exports = router;
