const mongoose = require('mongoose');

// Temporarily shared with follow-service during the extraction sequence.
const followSchema = new mongoose.Schema(
  {
    follower: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1 });

module.exports = mongoose.models.Follow || mongoose.model('Follow', followSchema);
