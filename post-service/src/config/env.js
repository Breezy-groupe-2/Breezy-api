require('dotenv').config();

const { z } = require('zod');

const placeholderPattern = /(?:change.*production|change[-_ ]?me|placeholder|example)/i;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().max(65535).default(3002),
  JWT_SECRET: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),
  S3_PUBLIC_URL: z.string().url(),
});

const parseEnv = (source) => {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path[0]))].join(', ');
    throw new Error(`Invalid environment configuration: ${names}`);
  }

  const production = result.data.NODE_ENV === 'production';
  const jwtSecret = result.data.JWT_SECRET || (production ? '' : 'test_secret');
  const mongodbUri =
    result.data.MONGODB_URI || (production ? '' : 'mongodb://localhost/breezy_posts');
  const invalid = [];

  if ((production && jwtSecret.length < 32) || placeholderPattern.test(jwtSecret)) {
    invalid.push('JWT_SECRET');
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongodbUri) || placeholderPattern.test(mongodbUri)) {
    invalid.push('MONGODB_URI');
  }
  const s3Values = {
    S3_ENDPOINT: result.data.S3_ENDPOINT,
    S3_ACCESS_KEY_ID: result.data.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: result.data.S3_SECRET_ACCESS_KEY,
    S3_BUCKET_NAME: result.data.S3_BUCKET_NAME,
    S3_PUBLIC_URL: result.data.S3_PUBLIC_URL,
  };
  for (const [name, value] of Object.entries(s3Values)) {
    if (placeholderPattern.test(value)) {
      invalid.push(name);
    }
  }
  if (invalid.length) {
    throw new Error(`Invalid environment configuration: ${invalid.join(', ')}`);
  }

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    jwtSecret,
    mongodbUri,
    s3: Object.freeze({
      endpoint: result.data.S3_ENDPOINT,
      accessKeyId: result.data.S3_ACCESS_KEY_ID,
      secretAccessKey: result.data.S3_SECRET_ACCESS_KEY,
      bucketName: result.data.S3_BUCKET_NAME,
      publicUrl: result.data.S3_PUBLIC_URL,
    }),
  });
};

const env = parseEnv(process.env);

module.exports = { env, parseEnv };
