const { Router } = require('express');
const { register } = require('./auth.controller');
const { validate, registerSchema } = require('./auth.validation');

const router = Router();

router.post('/register', validate(registerSchema), register);

module.exports = router;
