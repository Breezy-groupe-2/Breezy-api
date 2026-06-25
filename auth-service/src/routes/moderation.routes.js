const { Router } = require('express');
const {
  getReports,
  createReport,
  dismissReport,
  deleteContent,
  getAccounts,
} = require('../controllers/moderation.controller');
const { authenticate } = require('../middlewares/authenticate');
const { checkActive } = require('../middlewares/checkActive');
const { requireRole } = require('../middlewares/authorize');
const { validate, reportSchema } = require('../middlewares/validate');

const router = Router();

// Any authenticated active user can file a report (Fx20). Declared before the
// moderator/admin guard so it stays open to regular users.
router.post('/reports', authenticate, checkActive, validate(reportSchema), createReport);

// Every other moderation route requires an authenticated, active moderator/admin.
router.use(authenticate, checkActive, requireRole(['moderator', 'admin']));

router.get('/reports', getReports);
router.post('/reports/:id/dismiss', dismissReport);
router.delete('/content/:reportId', deleteContent);
router.get('/accounts', getAccounts);

module.exports = router;
