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
// which ones the viewer liked — all in a fixed number of queries (no N+1).
const serializePosts = async (posts, viewerId) => {
  if (posts.length === 0) return [];

  const postIds = posts.map((post) => post._id);
  const authorIds = posts.map((post) => post.author);

  const [usersById, likeAgg, viewerLikes, commentCounts] = await Promise.all([
    fetchUsersByIds(authorIds),
    Like.aggregate([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]),
    viewerId
      ? Like.find({ post: { $in: postIds }, user: viewerId }).select('post')
      : Promise.resolve([]),
    fetchCommentCounts(postIds),
  ]);

  const likeCountByPost = new Map(likeAgg.map((row) => [row._id.toString(), row.count]));
  const likedByViewer = new Set(viewerLikes.map((like) => like.post.toString()));

  return posts.map((post) => {
    const author = usersById.get(post.author.toString()) ?? fallbackUser(post.author);
    return {
      id: post._id.toString(),
      content: post.content,
      author: toAuthor(author),
      mediaUrl: post.mediaUrl || null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likeCount: likeCountByPost.get(post._id.toString()) ?? 0,
      isLiked: likedByViewer.has(post._id.toString()),
      commentsCount: Number(commentCounts.get(post._id.toString()) ?? 0),
    };
  });
};

const serializePost = async (post, viewerId) => (await serializePosts([post], viewerId))[0];

const createPost = async ({ content, mediaUrl, authorId }) => {
  const post = await Post.create({ content, mediaUrl, author: authorId });
  return serializePost(post, authorId);
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

  const likes = await Like.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).select('post');
  const postIds = likes.map((like) => like.post);
  if (postIds.length === 0) return [];

  const posts = await Post.find({ _id: { $in: postIds } });
  // Preserve "most recently liked first" (Mongo $in does not guarantee order).
  const rank = new Map(postIds.map((id, index) => [id.toString(), index]));
  posts.sort((a, b) => rank.get(a._id.toString()) - rank.get(b._id.toString()));
  return serializePosts(posts, viewerId);
};

// Global timeline: every post, newest first (the "Général" tab).
const getAllPosts = async (viewerId, limit = 50) => {
  const posts = await Post.find().sort({ createdAt: -1 }).limit(limit);
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

  const posts = await Post.find({ author: { $in: authorIds } }).sort({ createdAt: -1 }).limit(limit);
  return serializePosts(posts, viewerId);
};

module.exports = {
  createPost,
  updatePost,
  deletePost,
  getPostById,
  getPostsByUser,
  getLikedPosts,
  getPostsByAuthors,
  getAllPosts,
  getTrends,
  postNotFoundError,
};
