const { Router } = require('express');
const { addReply, getReplies } = require('../controllers/reply.controller');
const { authenticate } = require('../middlewares/authenticate');
const { contentSchema, validate } = require('../middlewares/validate');

/**
 * @openapi
 * /comments/{commentId}/replies:
 *   post:
 *     summary: Reply to a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: commentId
 *         in: path
 *         required: true
 *         description: Parent Comment ID
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
 *         description: Reply added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReplyResponse'
 *       400:
 *         description: Validation failed (empty content, > 280 characters, or invalid id format)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Comment not found
 *   get:
 *     summary: List replies of a comment
 *     description: Retrieves replies in chronological order.
 *     tags: [Comments]
 *     parameters:
 *       - name: commentId
 *         in: path
 *         required: true
 *         description: Parent Comment ID
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
 *                 $ref: '#/components/schemas/ReplyResponse'
 *       400:
 *         description: Invalid id format
 */

const router = Router({ mergeParams: true });

router.post('/', authenticate, validate(contentSchema), addReply);
router.get('/', getReplies);

module.exports = router;
