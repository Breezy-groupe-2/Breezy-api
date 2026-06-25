const { Router } = require('express');
const { moderateUser } = require('../../controllers/user.controller');
const { validate, moderationSchema } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { requireRole } = require('../../middlewares/authorize');
const { checkActive } = require('../../middlewares/checkActive');

/**
 * @openapi
 * components:
 *   schemas:
 *     ModerationRequest:
 *       type: object
 *       required: [status, reason]
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, suspended, banned]
 *           example: suspended
 *         durationHours:
 *           type: integer
 *           description: Duration in hours for temporary suspensions (optional)
 *           example: 24
 *         reason:
 *           type: string
 *           example: Violation of community rules
 *     ModerationResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 651a2b3c4d5e6f7a8b9c0d1e
 *         moderationStatus:
 *           type: string
 *           example: suspended
 *         bannedUntil:
 *           type: string
 *           format: date-time
 *           example: "2026-06-16T15:30:00.000Z"
 */

/**
 * @openapi
 * /users/{id}/moderation:
 *   patch:
 *     summary: Moderate a user (Suspend / Unsuspend)
 *     description: Allows moderators to suspend or unsuspend users.
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Target User ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModerationRequest'
 *     responses:
 *       200:
 *         description: User moderated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ModerationResponse'
 *       403:
 *         description: Forbidden - Moderator role required
 *       404:
 *         description: User not found
 */

const router = Router();

router.patch(
  '/:id/moderation',
  authenticate,
  checkActive,
  requireRole(['moderator', 'admin']),
  validate(moderationSchema),
  moderateUser
);

module.exports = router;
