const { z } = require('zod');

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
});

const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    bio: z.string().max(160).optional(),
    // Image URLs uploaded via the media service (empty string clears them).
    avatarUrl: z.string().optional(),
    bannerUrl: z.string().optional(),
  })
  .strip();

const createPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Content is required')
    .max(280, 'Content must be at most 280 characters'),
});

const moderationSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']),
  durationHours: z.number().optional(),
  reason: z.string().min(1, 'Reason is required'),
});

const updatePreferencesSchema = z
  .object({
    theme: z
      .object({
        mode: z.enum(['light', 'dark']),
        accentColor: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/, 'Accent color must be a #RRGGBB hex color'),
      })
      .strict(),
  })
  .strict();

const reportSchema = z
  .object({
    postId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Post id must be a valid Mongo id'),
    reason: z.enum(['Spam', 'Harcèlement', 'Contenu inapproprié', 'Désinformation']),
  })
  .strict();

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

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  googleAuthSchema,
  updateProfileSchema,
  createPostSchema,
  moderationSchema,
  reportSchema,
  updatePreferencesSchema,
};
