const { Router } = require('express');
const {
  followUser,
  getFollowers,
  getFollowing,
  unfollowUser,
} = require('../controllers/follow.controller');
const { authenticate } = require('../middlewares/authenticate');

const router = Router({ mergeParams: true });

router.post('/follow', authenticate, followUser);
router.delete('/follow', authenticate, unfollowUser);
router.get('/followers', getFollowers);
router.get('/following', getFollowing);

module.exports = router;
