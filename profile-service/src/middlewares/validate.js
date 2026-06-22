const { z } = require('zod');

const updateProfileSchema = z.object({
  bio: z.string().max(160, 'Bio must be at most 160 characters').optional(),
  avatarUrl: z.string().url('Avatar URL must be a valid URL').optional(),
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

module.exports = { validate, updateProfileSchema };
