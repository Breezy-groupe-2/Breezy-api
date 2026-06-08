const { Router } = require('express');
const { register } = require('../controllers/authController');
const { validate, registerSchema } = require('../middleware/validate');

const router = Router();

router.post('/register', validate(registerSchema), register);

module.exports = router;
