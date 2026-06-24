const { Router } = require('express');
const {
  getReports,
  dismissReport,
  deleteContent,
  getAccounts,
} = require('../controllers/moderation.controller');
const { authenticate } = require('../middlewares/authenticate');
const { checkActive } = require('../middlewares/checkActive');
const { requireRole } = require('../middlewares/authorize');

const router = Router();

// Every moderation route requires an authenticated, active moderator/admin.
router.use(authenticate, checkActive, requireRole(['moderator', 'admin']));

router.get('/reports', getReports);
router.post('/reports/:id/dismiss', dismissReport);
router.delete('/content/:reportId', deleteContent);
router.get('/accounts', getAccounts);

module.exports = router;
