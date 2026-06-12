const { Router } = require('express');
const { addReply, getReplies } = require('../controllers/reply.controller');
const { authenticate } = require('../middlewares/authenticate');

const router = Router({ mergeParams: true });

router.post('/', authenticate, addReply);
router.get('/', getReplies);

module.exports = router;
