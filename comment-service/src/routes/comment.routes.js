const { Router } = require('express');
const { addComment, getComments } = require('../controllers/comment.controller');
const { authenticate } = require('../middlewares/authenticate');

const router = Router({ mergeParams: true });

router.post('/', authenticate, addComment);
router.get('/', getComments);

module.exports = router;
