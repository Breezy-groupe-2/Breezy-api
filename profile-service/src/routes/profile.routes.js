const { Router } = require('express');
const { getProfile, getOwnProfile, updateProfile } = require('../controllers/profile.controller');
const { authenticate } = require('../middlewares/authenticate');
const { validate, updateProfileSchema } = require('../middlewares/validate');

/**
 * @openapi
 * components:
 *   schemas:
 *     PublicProfileResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 651a2b3c4d5e6f7a8b9c0d1e
 *         username:
 *           type: string
 *           example: janedoe
 *         displayName:
 *           type: string
 *           example: Jane Doe
 *         bio:
 *           type: string
 *           example: Explorer of the digital frontier.
 *         avatarUrl:
 *           type: string
 *           format: uri
 *           example: https://example.com/jane.png
 *         followerCount:
 *           type: integer
 *           example: 150
 *         followingCount:
 *           type: integer
 *           example: 230
 *         postCount:
 *           type: integer
 *           example: 42
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         displayName:
 *           type: string
 *           maxLength: 50
 *           example: Jane Doe
 *         bio:
 *           type: string
 *           maxLength: 160
 *           example: Updated bio text.
 *         avatarUrl:
 *           type: string
 *           format: uri
 *           example: https://example.com/jane-new.png
 */

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Get public profile details
 *     tags: [Profiles]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The user ID to retrieve the profile for
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PublicProfileResponse'
 *       404:
 *         description: User profile not found
 *
 * /users/me:
 *   get:
 *     summary: Get current user profile details
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PublicProfileResponse'
 *       401:
 *         description: Unauthorized
 *   put:
 *     summary: Update current user profile info
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PublicProfileResponse'
 *       400:
 *         description: Validation failed (bio length, avatar URL structure)
 *       401:
 *         description: Unauthorized
 */

const router = Router();

router.get('/me', authenticate, getOwnProfile);
router.get('/:id', getProfile);
router.put('/me', authenticate, validate(updateProfileSchema), updateProfile);

module.exports = router;
