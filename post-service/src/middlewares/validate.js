const { z } = require('zod');

const postContentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(280, 'Content must be at most 280 characters'),
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
