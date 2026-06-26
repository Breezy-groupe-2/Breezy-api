const { parseEnv } = require('../config/env');

const productionConfig = {
  NODE_ENV: 'production',
  PORT: '4100',
  JWT_SECRET: 's'.repeat(48),
  MONGODB_URI: 'mongodb://service-user:strong-local-pass@database:27017/service',
  S3_ENDPOINT: 'http://minio:9000',
  S3_ACCESS_KEY_ID: 'service-access-key',
  S3_SECRET_ACCESS_KEY: 'service-secret-key',
  S3_BUCKET_NAME: 'breezy-media',
  S3_PUBLIC_URL: 'http://localhost:3000/breezy-media',
};

describe('environment configuration', () => {
  it('parses and freezes valid test configuration', () => {
    const config = parseEnv({
      NODE_ENV: 'test',
      PORT: '4101',
      JWT_SECRET: 'test_secret',
      MONGODB_URI: 'mongodb://localhost/service_test',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY_ID: 'test-access-key',
      S3_SECRET_ACCESS_KEY: 'test-secret-key',
      S3_BUCKET_NAME: 'breezy-media-test',
      S3_PUBLIC_URL: 'http://localhost:3000/breezy-media-test',
    });

    expect(config).toMatchObject({
      nodeEnv: 'test',
      port: 4101,
      s3: {
        endpoint: 'http://localhost:9000',
        bucketName: 'breezy-media-test',
        publicUrl: 'http://localhost:3000/breezy-media-test',
      },
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.s3)).toBe(true);
  });

  it('rejects a missing NODE_ENV instead of assuming development', () => {
    expect(() => parseEnv({ PORT: '4100' })).toThrow(/NODE_ENV/);
  });

  it('rejects missing production credentials', () => {
    expect(() => parseEnv({ ...productionConfig, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...productionConfig, MONGODB_URI: undefined })).toThrow(/MONGODB_URI/);
  });

  it('rejects missing S3 configuration', () => {
    expect(() => parseEnv({ ...productionConfig, S3_ENDPOINT: undefined })).toThrow(/S3_ENDPOINT/);
    expect(() => parseEnv({ ...productionConfig, S3_ACCESS_KEY_ID: undefined })).toThrow(
      /S3_ACCESS_KEY_ID/
    );
    expect(() => parseEnv({ ...productionConfig, S3_SECRET_ACCESS_KEY: undefined })).toThrow(
      /S3_SECRET_ACCESS_KEY/
    );
    expect(() => parseEnv({ ...productionConfig, S3_BUCKET_NAME: undefined })).toThrow(
      /S3_BUCKET_NAME/
    );
    expect(() => parseEnv({ ...productionConfig, S3_PUBLIC_URL: undefined })).toThrow(
      /S3_PUBLIC_URL/
    );
  });

  it('rejects placeholder credentials', () => {
    expect(() =>
      parseEnv({
        ...productionConfig,
        JWT_SECRET: 'change-me-before-production',
        MONGODB_URI: 'mongodb://placeholder.invalid/service',
        S3_ACCESS_KEY_ID: 'change-me',
        S3_BUCKET_NAME: 'example-bucket',
      })
    ).toThrow(/JWT_SECRET, MONGODB_URI, S3_ACCESS_KEY_ID, S3_BUCKET_NAME/);
  });

  it('does not echo credential values in validation errors', () => {
    const jwtSecret = 'change-me-sensitive-fragment';
    const mongodbUri = 'mongodb://placeholder.invalid/sensitive-fragment';

    try {
      parseEnv({ ...productionConfig, JWT_SECRET: jwtSecret, MONGODB_URI: mongodbUri });
      throw new Error('Expected environment validation to fail');
    } catch (error) {
      expect(error.message).toContain('JWT_SECRET');
      expect(error.message).toContain('MONGODB_URI');
      expect(error.message).not.toContain(jwtSecret);
      expect(error.message).not.toContain(mongodbUri);
      expect(error.message).not.toContain('sensitive-fragment');
    }
  });
});
