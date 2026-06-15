const { Router } = require('express');
const { register, login, me } = require('../../controllers/auth.controller');
const { validate, registerSchema, loginSchema } = require('../../middlewares/validate');
const { authenticate } = require('../../middlewares/authenticate');
const { checkActive } = require('../../middlewares/checkActive');

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticate, checkActive, me);

module.exports = router;
