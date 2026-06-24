const mongoose = require('mongoose');
const Report = require('../models/report.model');
const User = require('../models/user.model');

const serializeReport = (report) => ({
  id: report._id.toString(),
  kind: report.kind,
  author: {
    username: report.author.username,
    displayName: report.author.displayName,
    avatarUrl: report.author.avatarUrl ?? '',
  },
  reason: report.reason,
  count: report.count,
  time: report.createdAt.toISOString(),
  text: report.text,
  ...(report.onPostAuthor?.username
    ? {
        onPostAuthor: {
          username: report.onPostAuthor.username,
          displayName: report.onPostAuthor.displayName,
        },
      }
    : {}),
});

const notFound = (message) => {
  const err = new Error(message);
  err.status = 404;
  return err;
};

const listReports = async () => {
  const reports = await Report.find({ status: 'pending' }).sort({ createdAt: -1 });
  return reports.map(serializeReport);
};

const dismissReport = async (reportId) => {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    throw notFound('Report not found');
  }
  const report = await Report.findById(reportId);
  if (!report) {
    throw notFound('Report not found');
  }
  report.status = 'dismissed';
  await report.save();
};

// Removing the reported content lives in the post/comment services; from the
// moderation queue's perspective the report is resolved as "actioned".
const deleteContent = async (reportId) => {
  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    throw notFound('Report not found');
  }
  const report = await Report.findById(reportId);
  if (!report) {
    throw notFound('Report not found');
  }
  report.status = 'actioned';
  await report.save();
};

const listAccounts = async () => {
  const users = await User.find().sort({ username: 1 });
  return users.map((user) => ({
    username: user.username,
    displayName: user.displayName || user.username,
    avatarUrl: user.avatarUrl || '',
    status: user.moderationStatus ?? 'active',
  }));
};

module.exports = { listReports, dismissReport, deleteContent, listAccounts };
