const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    content: { type: String, required: true, maxlength: 500, trim: true },
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

replySchema.index({ commentId: 1, createdAt: -1 });

module.exports = mongoose.model('Reply', replySchema);
