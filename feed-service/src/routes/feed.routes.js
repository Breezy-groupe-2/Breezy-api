const { Router } = require('express');
const { getFeed } = require('../controllers/feed.controller');
const { authenticate } = require('../middlewares/authenticate');

/**
 * @openapi
 * components:
 *   schemas:
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
 *         likeCount:
 *           type: integer
 *           example: 5
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-06-12T13:00:00.000Z"
 */

/**
 * @openapi
 * /feed:
 *   get:
 *     summary: Get chronological feed from followed users
 *     description: Returns post timelines from followed users, sorted newest first.
 *     tags: [Feed]
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
 */

const router = Router();

router.get('/', authenticate, getFeed);

module.exports = router;
