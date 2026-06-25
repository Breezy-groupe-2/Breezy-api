const mongoose = require('mongoose');
const { env } = require('../config/env');
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
  ...(report.postId ? { postId: report.postId.toString() } : {}),
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

const upstreamError = (message) => {
  const err = new Error(message);
  err.status = 502;
  return err;
};

const postServiceUrl = () => env.postServiceUrl.replace(/\/$/, '');

const fetchReportedPost = async (postId) => {
  let response;
  try {
    response = await fetch(`${postServiceUrl()}/api/v1/posts/${postId}`);
  } catch {
    throw upstreamError('Post service unavailable');
  }

  if (response.status === 404) {
    throw notFound('Post not found');
  }
  if (!response.ok) {
    throw upstreamError('Post service unavailable');
  }
  const post = await response.json();
  if (!post?.author?.username) {
    throw upstreamError('Post service unavailable');
  }
  return post;
};

const toSnapshot = (user) => ({
  username: user.username,
  displayName: user.displayName || user.username,
  avatarUrl: user.avatarUrl || '',
});

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

// A regular active user flags a post. The reported post snapshot is fetched
// server-side so clients cannot spoof moderation queue content.
const createReport = async ({ postId, reason, reporterId }) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw notFound('Post not found');
  }
  const [post, reporter] = await Promise.all([
    fetchReportedPost(postId),
    User.findById(reporterId).select('username displayName avatarUrl'),
  ]);
  if (!reporter) {
    throw notFound('User not found');
  }

  const postAuthor = post.author ?? {};
  const report = await Report.create({
    kind: 'post',
    reason,
    author: {
      username: postAuthor.username,
      displayName: postAuthor.displayName || postAuthor.username,
      avatarUrl: postAuthor.avatarUrl || '',
    },
    postId,
    text: post.content || '',
    reporter: {
      userId: reporter._id,
      ...toSnapshot(reporter),
    },
  });
  return serializeReport(report);
};

module.exports = { listReports, createReport, dismissReport, deleteContent, listAccounts };
