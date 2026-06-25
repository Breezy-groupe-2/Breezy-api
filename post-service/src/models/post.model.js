const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    // Empty for a plain repost; the quote text for a quote repost; required for
    // a normal post (enforced in the service/validation layer).
    content: { type: String, default: '', maxlength: 280, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    mediaUrl: { type: String, trim: true, default: null },
    // Set when this post reposts another one (plain repost or quote repost).
    repostOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
  },
  { timestamps: true }
);

// A user can have at most one plain repost (no quote text) of a given post.
postSchema.index(
  { author: 1, repostOf: 1 },
  { unique: true, partialFilterExpression: { repostOf: { $type: 'objectId' }, content: '' } }
);

module.exports = mongoose.models.Post || mongoose.model('Post', postSchema);
