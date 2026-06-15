const { Router } = require('express');
const { addReply, getReplies } = require('../controllers/reply.controller');
const { authenticate } = require('../middlewares/authenticate');
const { contentSchema, validate } = require('../middlewares/validate');

const router = Router({ mergeParams: true });

router.post('/', authenticate, validate(contentSchema), addReply);
router.get('/', getReplies);

module.exports = router;
