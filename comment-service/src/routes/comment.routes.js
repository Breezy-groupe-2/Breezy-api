const { Router } = require('express');
const { addComment, getComments } = require('../controllers/comment.controller');
const { authenticate } = require('../middlewares/authenticate');
const { contentSchema, validate } = require('../middlewares/validate');

const router = Router({ mergeParams: true });

router.post('/', authenticate, validate(contentSchema), addComment);
router.get('/', getComments);

module.exports = router;
