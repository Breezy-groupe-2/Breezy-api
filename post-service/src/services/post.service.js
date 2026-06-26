const mongoose = require('mongoose');
const Like = require('../models/like.model');
const Post = require('../models/post.model');
const {
  fetchUsersByIds,
  fetchUserIdByUsername,
  fetchCommentCounts,
  fallbackUser,
} = require('../utils/users');

const postNotFoundError = (status = 404) => {
  const err = new Error('Post not found');
  err.status = status;
  return err;
};

const toAuthor = (user) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
});

// Serialize a batch of posts: enrich authors, aggregate like counts, and flag
// which ones the viewer liked/reposted - all in a fixed number of queries (no
// N+1). `embedOriginals` is set to false on the recursive call so reposts never
// nest deeper than one level.
const serializePosts = async (posts, viewerId, { embedOriginals = true } = {}) => {
  if (posts.length === 0) return [];

  const postIds = posts.map((post) => post._id);
  const authorIds = posts.map((post) => post.author);
  const originalIds = posts.map((post) => post.repostOf).filter(Boolean);

  const [usersById, likeAgg, viewerLikes, commentCounts, repostAgg, viewerReposts, originals] =
    await Promise.all([
      fetchUsersByIds(authorIds),
      Like.aggregate([
        { $match: { post: { $in: postIds } } },
        { $group: { _id: '$post', count: { $sum: 1 } } },
      ]),
      viewerId
        ? Like.find({ post: { $in: postIds }, user: viewerId }).select('post')
        : Promise.resolve([]),
      fetchCommentCounts(postIds),
      Post.aggregate([
        { $match: { repostOf: { $in: postIds } } },
        { $group: { _id: '$repostOf', count: { $sum: 1 } } },
      ]),
      viewerId
        ? Post.find({ repostOf: { $in: postIds }, author: viewerId, content: '' }).select(
            'repostOf'
          )
        : Promise.resolve([]),
      embedOriginals && originalIds.length
        ? Post.find({ _id: { $in: originalIds } })
        : Promise.resolve([]),
    ]);

  const likeCountByPost = new Map(likeAgg.map((row) => [row._id.toString(), row.count]));
  const likedByViewer = new Set(viewerLikes.map((like) => like.post.toString()));
  const repostCountByPost = new Map(repostAgg.map((row) => [row._id.toString(), row.count]));
  const repostedByViewer = new Set(viewerReposts.map((r) => r.repostOf.toString()));

  // Serialize embedded originals one level deep (no further nesting).
  const originalsSerialized = originals.length
    ? await serializePosts(originals, viewerId, { embedOriginals: false })
    : [];
  const originalById = new Map(originalsSerialized.map((o) => [o.id, o]));

  return posts.map((post) => {
    const author = usersById.get(post.author.toString()) ?? fallbackUser(post.author);
    const id = post._id.toString();
    return {
      id,
      content: post.content,
      author: toAuthor(author),
      mediaUrl: post.mediaUrl || null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likeCount: likeCountByPost.get(id) ?? 0,
      isLiked: likedByViewer.has(id),
      commentsCount: Number(commentCounts.get(id) ?? 0),
      repostCount: repostCountByPost.get(id) ?? 0,
      isReposted: repostedByViewer.has(id),
      repostOf: post.repostOf ? (originalById.get(post.repostOf.toString()) ?? null) : null,
    };
  });
};

const serializePost = async (post, viewerId) => (await serializePosts([post], viewerId))[0];

// Resolve the canonical post a repost should point at: if the target is itself a
// repost, flatten to its root so we never build deep repost chains.
const resolveRepostTarget = async (postId) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw postNotFoundError(400);
  }
  const target = await Post.findById(postId);
  if (!target) {
    throw postNotFoundError();
  }
  return target.repostOf || target._id;
};

const createPost = async ({ content, mediaUrl, repostOf, authorId }) => {
  // A `repostOf` makes this a quote repost (it always carries content here, since
  // plain reposts go through repostPost). Flatten the target to its root post.
  const repostTarget = repostOf ? await resolveRepostTarget(repostOf) : null;
  const post = await Post.create({ content, mediaUrl, repostOf: repostTarget, author: authorId });
  return serializePost(post, authorId);
};

// Plain repost (no quote text). Idempotent: returns the existing repost if any.
const repostPost = async ({ postId, authorId }) => {
  const targetId = await resolveRepostTarget(postId);
  const existing = await Post.findOne({ repostOf: targetId, author: authorId, content: '' });
  const repost =
    existing || (await Post.create({ author: authorId, content: '', repostOf: targetId }));
  return serializePost(repost, authorId);
};

const unrepostPost = async ({ postId, authorId }) => {
  const targetId = await resolveRepostTarget(postId);
  await Post.deleteOne({ repostOf: targetId, author: authorId, content: '' });
};

const updatePost = async ({ postId, content, mediaUrl, authorId }) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw postNotFoundError(400);
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw postNotFoundError();
  }
  if (post.author.toString() !== authorId.toString()) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  post.content = content;
  if (mediaUrl !== undefined) {
    post.mediaUrl = mediaUrl;
  }
  await post.save();
  return serializePost(post, authorId);
};

const getPostById = async (postId, viewerId) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw postNotFoundError(400);
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw postNotFoundError();
  }
  return serializePost(post, viewerId);
};

const deletePost = async ({ postId, authorId }) => {
  if (!mongoose.Types.ObjectId.isValid(postId)) {
    throw postNotFoundError(400);
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw postNotFoundError();
  }
  if (post.author.toString() !== authorId.toString()) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }

  await Like.deleteMany({ post: post._id });
  // Remove any reposts pointing at this post so feeds don't show dangling cards.
  await Post.deleteMany({ repostOf: post._id });
  await post.deleteOne();
};

// Accepts a Mongo id (own posts) or a username (front profile URLs).
const getPostsByUser = async (idOrUsername, viewerId) => {
  let authorId = idOrUsername;
  if (!mongoose.Types.ObjectId.isValid(idOrUsername)) {
    authorId = await fetchUserIdByUsername(idOrUsername);
    if (!authorId) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
  }

  const posts = await Post.find({ author: authorId }).sort({ createdAt: -1 });
  return serializePosts(posts, viewerId);
};

// Full-text-ish search over post content (used for hashtag/keyword search from
// the Discover page). Case-insensitive, newest first, query treated as literal.
const searchPosts = async (rawQuery, viewerId, limit = 50) => {
  const query = (rawQuery || '').trim();
  if (!query) return [];
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(safe, 'i');
  const posts = await Post.find({ content: regex }).sort({ createdAt: -1 }).limit(limit);
  return serializePosts(posts, viewerId);
};

// Posts liked by a user (the profile "Likes" tab), most recently liked first.
// Accepts a Mongo id or a username.
const getLikedPosts = async (idOrUsername, viewerId, limit = 50) => {
  let userId = idOrUsername;
  if (!mongoose.Types.ObjectId.isValid(idOrUsername)) {
    userId = await fetchUserIdByUsername(idOrUsername);
    if (!userId) {
      const err = new Error('User not found');
      err.status = 404;
      throw err;
    }
  }

  const likes = await Like.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('post');
  const postIds = likes.map((like) => like.post);
  if (postIds.length === 0) return [];

  const posts = await Post.find({ _id: { $in: postIds } });
  // Preserve "most recently liked first" (Mongo $in does not guarantee order).
  const rank = new Map(postIds.map((id, index) => [id.toString(), index]));
  posts.sort((a, b) => rank.get(a._id.toString()) - rank.get(b._id.toString()));
  return serializePosts(posts, viewerId);
};

// Global timeline: every post, newest first (the "General" tab). Plain reposts
// are excluded here so the original isn't shown twice; quote reposts (which add
// their own text) stay. The followed feed and profiles still surface reposts.
const getAllPosts = async (viewerId, limit = 50) => {
  const posts = await Post.find({ $or: [{ repostOf: null }, { content: { $ne: '' } }] })
    .sort({ createdAt: -1 })
    .limit(limit);
  return serializePosts(posts, viewerId);
};

// Trending hashtags aggregated from post contents (case-insensitive).
const getTrends = async (limit = 5) => {
  const posts = await Post.find().select('content').limit(500);
  const counts = new Map();
  for (const post of posts) {
    const tags = post.content.match(/#[\p{L}0-9_]+/gu) || [];
    for (const raw of tags) {
      const tag = raw.toLowerCase();
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
};

const getPostsByAuthors = async ({ authorIds, limit }, viewerId) => {
  if (authorIds.length === 0) {
    return [];
  }

  const posts = await Post.find({ author: { $in: authorIds } })
    .sort({ createdAt: -1 })
    .limit(limit);
  return serializePosts(posts, viewerId);
};

module.exports = {
  createPost,
  repostPost,
  unrepostPost,
  updatePost,
  deletePost,
  getPostById,
  getPostsByUser,
  getLikedPosts,
  getPostsByAuthors,
  getAllPosts,
  searchPosts,
  getTrends,
  postNotFoundError,
};
