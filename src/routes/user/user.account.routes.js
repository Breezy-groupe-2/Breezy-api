const { Router } = require('express');
const { register } = require('../../controllers/auth.controller');
const { validate, registerSchema } = require('../../middlewares/validate');

const router = Router();

router.post('/register', validate(registerSchema), register);

module.exports = router;
