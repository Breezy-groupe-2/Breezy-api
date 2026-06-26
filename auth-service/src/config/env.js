require('dotenv').config();

const { z } = require('zod');

const placeholderPattern = /(?:change.*production|change[-_ ]?me|placeholder|example)/i;
const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional()
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: optionalNonEmptyString,
  JWT_EXPIRE: optionalNonEmptyString,
  MONGODB_URI: z.string().optional(),
  POST_SERVICE_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

const parseEnv = (source) => {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path[0]))].join(', ');
    throw new Error(`Invalid environment configuration: ${names}`);
  }

  const production = result.data.NODE_ENV === 'production';
  const jwtSecret = result.data.JWT_SECRET || (production ? '' : 'test_secret');
  const jwtExpiresIn = result.data.JWT_EXPIRES_IN || result.data.JWT_EXPIRE || '15m';
  const mongodbUri =
    result.data.MONGODB_URI || (production ? '' : 'mongodb://localhost/breezy_auth');
  const postServiceUrl =
    result.data.POST_SERVICE_URL || (production ? '' : 'http://post-service:3002');
  const invalid = [];

  if ((production && jwtSecret.length < 32) || placeholderPattern.test(jwtSecret)) {
    invalid.push('JWT_SECRET');
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongodbUri) || placeholderPattern.test(mongodbUri)) {
    invalid.push('MONGODB_URI');
  }
  if (!postServiceUrl || placeholderPattern.test(postServiceUrl)) {
    invalid.push('POST_SERVICE_URL');
  }
  if (invalid.length) {
    throw new Error(`Invalid environment configuration: ${invalid.join(', ')}`);
  }

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    jwtSecret,
    jwtExpiresIn,
    mongodbUri,
    postServiceUrl,
    googleClientId: result.data.GOOGLE_CLIENT_ID || '',
  });
};

const env = parseEnv(process.env);

module.exports = { env, parseEnv };
