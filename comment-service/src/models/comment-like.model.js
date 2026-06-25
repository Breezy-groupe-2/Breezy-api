const mongoose = require('mongoose');

// A like on a comment OR a reply. `target` is the comment/reply id (both are
// distinct ObjectIds, so a single collection covers both).
const commentLikeSchema = new mongoose.Schema(
  {
    target: { type: mongoose.Schema.Types.ObjectId, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

commentLikeSchema.index({ target: 1, user: 1 }, { unique: true });

module.exports = mongoose.models.CommentLike || mongoose.model('CommentLike', commentLikeSchema);
