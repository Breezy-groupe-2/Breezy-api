const { parseEnv } = require('../config/env');

const productionConfig = {
  NODE_ENV: 'production',
  PORT: '4100',
  JWT_SECRET: 's'.repeat(48),
  MONGODB_URI: 'mongodb://service-user:strong-local-pass@database:27017/service',
  POST_SERVICE_URL: 'http://post-service:3002',
};

describe('environment configuration', () => {
  it('parses and freezes valid test configuration', () => {
    const config = parseEnv({
      NODE_ENV: 'test',
      PORT: '4101',
      JWT_SECRET: 'test_secret',
      MONGODB_URI: 'mongodb://localhost/service_test',
      POST_SERVICE_URL: 'http://localhost:3002',
    });

    expect(config).toMatchObject({ nodeEnv: 'test', port: 4101 });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('uses JWT_EXPIRES_IN as the canonical token expiry setting', () => {
    const config = parseEnv({
      NODE_ENV: 'test',
      JWT_EXPIRES_IN: '30m',
      JWT_EXPIRE: '7d',
    });

    expect(config.jwtExpiresIn).toBe('30m');
  });

  it('keeps JWT_EXPIRE as a backward-compatible token expiry alias', () => {
    const config = parseEnv({
      NODE_ENV: 'test',
      JWT_EXPIRE: '7d',
    });

    expect(config.jwtExpiresIn).toBe('7d');
  });

  it('defaults token expiry when no expiry env var is provided', () => {
    const config = parseEnv({ NODE_ENV: 'test' });

    expect(config.jwtExpiresIn).toBe('15m');
  });

  it('treats blank token expiry env vars as unset', () => {
    const config = parseEnv({
      NODE_ENV: 'test',
      JWT_EXPIRES_IN: '',
      JWT_EXPIRE: '',
    });

    expect(config.jwtExpiresIn).toBe('15m');
  });

  it('rejects a missing NODE_ENV instead of assuming development', () => {
    expect(() => parseEnv({ PORT: '4100' })).toThrow(/NODE_ENV/);
  });

  it('rejects missing production credentials', () => {
    expect(() => parseEnv({ ...productionConfig, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...productionConfig, MONGODB_URI: undefined })).toThrow(/MONGODB_URI/);
    expect(() => parseEnv({ ...productionConfig, POST_SERVICE_URL: undefined })).toThrow(
      /POST_SERVICE_URL/
    );
  });

  it('rejects placeholder credentials', () => {
    expect(() =>
      parseEnv({
        ...productionConfig,
        JWT_SECRET: 'change-me-before-production',
        MONGODB_URI: 'mongodb://placeholder.invalid/service',
      })
    ).toThrow(/JWT_SECRET, MONGODB_URI/);
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
