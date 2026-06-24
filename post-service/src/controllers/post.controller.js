const mongoose = require('mongoose');
const postService = require('../services/post.service');

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const parseBatchPostQuery = (query) => {
  if (query.authorIds === undefined) {
    throw badRequest('authorIds query parameter is required');
  }

  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw badRequest('limit must be an integer from 1 to 100');
  }

  if (query.authorIds === '') {
    return { authorIds: [], limit };
  }

  const authorIds = query.authorIds.split(',');
  if (authorIds.length > 100) {
    throw badRequest('authorIds must contain at most 100 IDs');
  }
  if (authorIds.some((authorId) => !mongoose.Types.ObjectId.isValid(authorId))) {
    throw badRequest('authorIds must contain valid ObjectIds');
  }

  return { authorIds, limit };
};

const getPostsByAuthors = async (req, res, next) => {
  try {
    const query = parseBatchPostQuery(req.query);
    const posts = await postService.getPostsByAuthors(query, req.viewerId);
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
};

const getPostsByUser = async (req, res, next) => {
  try {
    const posts = await postService.getPostsByUser(req.params.userId, req.viewerId);
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
};

const searchPosts = async (req, res, next) => {
  try {
    const posts = await postService.searchPosts(req.query.q, req.viewerId);
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
};

const createPost = async (req, res, next) => {
  try {
    const post = await postService.createPost({
      content: req.body.content,
      mediaUrl: req.body.mediaUrl,
      authorId: req.user.sub,
    });
    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
};

const updatePost = async (req, res, next) => {
  try {
    const post = await postService.updatePost({
      postId: req.params.id,
      content: req.body.content,
      mediaUrl: req.body.mediaUrl,
      authorId: req.user.sub,
    });
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
};

const getAllPosts = async (req, res, next) => {
  try {
    const posts = await postService.getAllPosts(req.viewerId);
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
};

const getTrends = async (_req, res, next) => {
  try {
    const trends = await postService.getTrends();
    res.status(200).json(trends);
  } catch (err) {
    next(err);
  }
};

const getPost = async (req, res, next) => {
  try {
    const post = await postService.getPostById(req.params.id, req.viewerId);
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
};

const deletePost = async (req, res, next) => {
  try {
    await postService.deletePost({
      postId: req.params.id,
      authorId: req.user.sub,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const getOwnPosts = async (req, res, next) => {
  try {
    const posts = await postService.getPostsByUser(req.user.sub, req.user.sub);
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPost,
  updatePost,
  deletePost,
  getPost,
  getAllPosts,
  getTrends,
  getPostsByUser,
  getOwnPosts,
  getPostsByAuthors,
  searchPosts,
};
