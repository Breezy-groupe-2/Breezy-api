const { parseEnv } = require('../config/env');

const productionConfig = {
  NODE_ENV: 'production',
  PORT: '4100',
  JWT_SECRET: 's'.repeat(48),
  MONGODB_URI: 'mongodb://service-user:strong-local-pass@database:27017/service',
  INTERNAL_SERVICE_TOKEN: 'i'.repeat(48),
};

describe('environment configuration', () => {
  it('parses and freezes valid test configuration', () => {
    const config = parseEnv({
      NODE_ENV: 'test',
      PORT: '4101',
      JWT_SECRET: 'test_secret',
      MONGODB_URI: 'mongodb://localhost/service_test',
    });

    expect(config).toMatchObject({ nodeEnv: 'test', port: 4101 });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('rejects a missing NODE_ENV instead of assuming development', () => {
    expect(() => parseEnv({ PORT: '4100' })).toThrow(/NODE_ENV/);
  });

  it('rejects missing production credentials', () => {
    expect(() => parseEnv({ ...productionConfig, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
    expect(() => parseEnv({ ...productionConfig, MONGODB_URI: undefined })).toThrow(/MONGODB_URI/);
    expect(() => parseEnv({ ...productionConfig, INTERNAL_SERVICE_TOKEN: undefined })).toThrow(
      /INTERNAL_SERVICE_TOKEN/
    );
  });

  it('rejects placeholder credentials', () => {
    expect(() =>
      parseEnv({
        ...productionConfig,
        JWT_SECRET: 'change-me-before-production',
        MONGODB_URI: 'mongodb://placeholder.invalid/service',
        INTERNAL_SERVICE_TOKEN: 'change-me-before-production',
      })
    ).toThrow(/JWT_SECRET, MONGODB_URI, INTERNAL_SERVICE_TOKEN/);
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
