const { z } = require('zod');

const placeholderPattern = /(?:change.*production|change[-_ ]?me|placeholder|example)/i;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  MONGODB_URI: z.string().optional(),
});

const parseDatabaseConfig = (source) => {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path[0]))].join(', ');
    throw new Error(`Invalid environment configuration: ${names}`);
  }

  const production = result.data.NODE_ENV === 'production';
  const mongodbUri = result.data.MONGODB_URI;

  if (!mongodbUri) {
    if (production) {
      throw new Error('MONGODB_URI is required in production');
    }
    // Development/test fallback - use local MongoDB without credentials
    return Object.freeze({
      mongodbUri: 'mongodb://localhost/breezy_profiles',
    });
  }

  if (placeholderPattern.test(mongodbUri)) {
    throw new Error('MONGODB_URI contains placeholder values');
  }

  if (!/^mongodb(?:\+srv)?:\/\//.test(mongodbUri)) {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string');
  }

  return Object.freeze({ mongodbUri });
};

module.exports = parseDatabaseConfig(process.env);
