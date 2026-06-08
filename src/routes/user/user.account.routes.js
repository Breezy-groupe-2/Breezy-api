const { Router } = require('express');
const { register, login } = require('../../controllers/auth.controller');
const { validate, registerSchema, loginSchema } = require('../../middlewares/validate');

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

module.exports = router;
