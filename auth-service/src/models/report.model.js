const mongoose = require('mongoose');

// A moderation report flags a post for review. Author/onPostAuthor are
// denormalized snapshots so the moderation queue can render without fanning out.
const reportSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['post'],
      required: true,
    },
    reason: {
      type: String,
      enum: ['Spam', 'Harcèlement', 'Contenu inapproprié', 'Désinformation'],
      required: true,
    },
    author: {
      username: { type: String, required: true },
      displayName: { type: String, required: true },
      avatarUrl: { type: String },
      _id: false,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    onPostAuthor: {
      type: {
        username: { type: String, required: true },
        displayName: { type: String, required: true },
        _id: false,
      },
      default: undefined,
    },
    reporter: {
      type: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        username: { type: String, required: true },
        displayName: { type: String, required: true },
        avatarUrl: { type: String },
        _id: false,
      },
      required: true,
    },
    count: {
      type: Number,
      default: 1,
      min: 1,
    },
    text: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'dismissed', 'actioned'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Report || mongoose.model('Report', reportSchema);
