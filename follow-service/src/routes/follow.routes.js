const { Router } = require('express');
const {
  followUser,
  getFollowers,
  getFollowing,
  unfollowUser,
} = require('../controllers/follow.controller');
const { authenticate } = require('../middlewares/authenticate');

/**
 * @openapi
 * components:
 *   schemas:
 *     UserSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 651a2b3c4d5e6f7a8b9c0d1e
 *         username:
 *           type: string
 *           example: follower_user
 */

/**
 * @openapi
 * /users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     description: Creates a follow connection between the authenticated user and the target user.
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the user to follow
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully followed the user
 *       400:
 *         description: Cannot follow yourself or invalid ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Already following this user
 *   delete:
 *     summary: Unfollow a user
 *     description: Removes a follow connection between the authenticated user and the target user.
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the user to unfollow
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully unfollowed the user
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *
 * /users/{id}/followers:
 *   get:
 *     summary: Get list of followers for a user
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of followers
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserSummary'
 *       401:
 *         description: Unauthorized
 *
 * /users/{id}/following:
 *   get:
 *     summary: Get list of users followed by a user
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of followed users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserSummary'
 *       401:
 *         description: Unauthorized
 */

const router = Router({ mergeParams: true });

router.post('/follow', authenticate, followUser);
router.delete('/follow', authenticate, unfollowUser);
router.get('/followers', getFollowers);
router.get('/following', getFollowing);

module.exports = router;
