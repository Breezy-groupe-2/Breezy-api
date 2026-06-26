require('dotenv').config();

const { z } = require('zod');

const placeholderPattern = /(?:change.*production|change[-_ ]?me|placeholder|example)/i;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().max(65535).default(3006),
  JWT_SECRET: z.string().optional(),
  MONGODB_URI: z.string().optional(),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
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
    result.data.MONGODB_URI || (production ? '' : 'mongodb://localhost/breezy_auth');
  const internalServiceToken =
    result.data.INTERNAL_SERVICE_TOKEN || (production ? '' : 'test_internal_service_token');
  const invalid = [];

  if ((production && jwtSecret.length < 32) || placeholderPattern.test(jwtSecret)) {
    invalid.push('JWT_SECRET');
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongodbUri) || placeholderPattern.test(mongodbUri)) {
    invalid.push('MONGODB_URI');
  }
  if (
    (production && internalServiceToken.length < 32) ||
    placeholderPattern.test(internalServiceToken)
  ) {
    invalid.push('INTERNAL_SERVICE_TOKEN');
  }
  if (invalid.length) {
    throw new Error(`Invalid environment configuration: ${invalid.join(', ')}`);
  }

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    jwtSecret,
    mongodbUri,
    internalServiceToken,
  });
};

const env = parseEnv(process.env);

module.exports = { env, parseEnv };
