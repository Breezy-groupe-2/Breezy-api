const { configDefaults, defineConfig } = require('vitest/config');

// Local config so post-service tests run from this package (with its own
// node_modules) instead of picking up the root config, whose relative
// setupFiles path resolves to a non-existent post-service/vitest.setup.js.
// JWT_SECRET is pinned here (config/env.js calls dotenv.config(), which would
// otherwise leak the repo .env secret and 401 every authenticated request).
module.exports = defineConfig({
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '**/*.acceptance.test.js'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test_secret',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY_ID: 'test-minio-access-key',
      S3_SECRET_ACCESS_KEY: 'test-minio-secret-key',
      S3_BUCKET_NAME: 'breezy-media-test',
      S3_PUBLIC_URL: 'http://localhost:3000/breezy-media-test',
    },
  },
});
