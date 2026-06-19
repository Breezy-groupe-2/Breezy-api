const { Router } = require('express');
const { register, login, me } = require('../../controllers/auth.controller');
const { validate, registerSchema, loginSchema } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { checkActive } = require('../../middlewares/checkActive');

/**
 * @openapi
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required: [username, email, password]
 *       properties:
 *         username:
 *           type: string
 *           minLength: 3
 *           pattern: "^[a-zA-Z0-9_]+$"
 *           example: janedoe
 *         email:
 *           type: string
 *           format: email
 *           example: jane@example.com
 *         password:
 *           type: string
 *           minLength: 8
 *           maxLength: 128
 *           example: SecurePassword123
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: jane@example.com
 *         password:
 *           type: string
 *           example: SecurePassword123
 *     AuthResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: 651a2b3c4d5e6f7a8b9c0d1e
 *             username:
 *               type: string
 *               example: janedoe
 *             email:
 *               type: string
 *               example: jane@example.com
 *             role:
 *               type: string
 *               enum: [user, moderator]
 *               example: user
 *     CurrentUserResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 651a2b3c4d5e6f7a8b9c0d1e
 *         username:
 *           type: string
 *           example: janedoe
 *         email:
 *           type: string
 *           example: jane@example.com
 *         role:
 *           type: string
 *           example: user
 *         preferences:
 *           $ref: '#/components/schemas/Preferences'
 *     Preferences:
 *       type: object
 *       properties:
 *         theme:
 *           type: object
 *           properties:
 *             mode:
 *               type: string
 *               enum: [light, dark]
 *               example: dark
 *             accentColor:
 *               type: string
 *               pattern: "^#[0-9A-Fa-f]{6}$"
 *               example: "#1DA1F2"
 *     UpdatePreferencesRequest:
 *       type: object
 *       required: [theme]
 *       properties:
 *         theme:
 *           type: object
 *           required: [mode, accentColor]
 *           properties:
 *             mode:
 *               type: string
 *               enum: [light, dark]
 *               example: dark
 *             accentColor:
 *               type: string
 *               example: "#1DA1F2"
 *     PreferencesResponse:
 *       type: object
 *       properties:
 *         theme:
 *           type: object
 *           properties:
 *             mode:
 *               type: string
 *               example: dark
 *             accentColor:
 *               type: string
 *               example: "#1DA1F2"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: Validation failed
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 example: email
 *               message:
 *                 type: string
 *                 example: Invalid email format
 */

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     description: Creates a new user profile and returns a signed JWT access token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Username or Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/login:
 *   post:
 *     summary: Authenticate user and return token
 *     description: Validates user credentials and returns a signed JWT access token.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account is suspended or deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /auth/me:
 *   get:
 *     summary: Get authenticated user profile details
 *     description: Returns details of the currently authenticated user session.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurrentUserResponse'
 *       401:
 *         description: Missing or invalid authentication token
 *       403:
 *         description: Account is suspended
 *
 * /users/me/preferences:
 *   patch:
 *     summary: Update user preferences (theme)
 *     description: Updates theme configurations (mode and accent color) for the authenticated user.
 *     tags: [User Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePreferencesRequest'
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PreferencesResponse'
 *       400:
 *         description: Invalid preferences payload
 *       401:
 *         description: Unauthorized
 */

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticate, checkActive, me);

module.exports = router;
