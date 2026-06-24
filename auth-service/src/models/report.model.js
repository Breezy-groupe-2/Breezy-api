const mongoose = require('mongoose');

// A moderation report flags a piece of content (post or comment) for review.
// Author/onPostAuthor are denormalized snapshots so the moderation queue can be
// rendered without fanning out to the post/comment services.
const reportSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['post', 'comment'],
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
    onPostAuthor: {
      type: {
        username: { type: String, required: true },
        displayName: { type: String, required: true },
        _id: false,
      },
      default: undefined,
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
