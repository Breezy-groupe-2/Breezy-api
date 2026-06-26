const { z } = require('zod');

const postContentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(280, 'Content must be at most 280 characters'),
  mediaUrl: z.string().url('Invalid media URL format').trim().optional().nullable(),
  // Id of the post being quoted (quote repost). Plain reposts use a dedicated route.
  repostOf: z.string().optional().nullable(),
});

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((e) => ({ field: e.path[0], message: e.message })),
    });
  }
  req.body = result.data;
  next();
};

module.exports = { validate, postContentSchema };
