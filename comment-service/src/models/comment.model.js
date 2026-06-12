const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, maxlength: 500, trim: true },
    postId: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

commentSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
