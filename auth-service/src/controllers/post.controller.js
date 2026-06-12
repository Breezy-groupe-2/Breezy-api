const postService = require('../services/post.service');

const createPost = async (req, res, next) => {
  try {
    const post = await postService.createPost({
      content: req.body.content,
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
      authorId: req.user.sub,
    });
    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
};

module.exports = { createPost, updatePost };
