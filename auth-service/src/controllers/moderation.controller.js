const moderationService = require('../services/moderation.service');

const getReports = async (_req, res, next) => {
  try {
    const reports = await moderationService.listReports();
    res.status(200).json(reports);
  } catch (err) {
    next(err);
  }
};

const dismissReport = async (req, res, next) => {
  try {
    await moderationService.dismissReport(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const deleteContent = async (req, res, next) => {
  try {
    await moderationService.deleteContent(req.params.reportId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const getAccounts = async (_req, res, next) => {
  try {
    const accounts = await moderationService.listAccounts();
    res.status(200).json(accounts);
  } catch (err) {
    next(err);
  }
};

module.exports = { getReports, dismissReport, deleteContent, getAccounts };
