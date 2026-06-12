const { configDefaults, defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    exclude: configDefaults.exclude,
    globals: true,
    include: ['**/*.acceptance.test.js'],
    testTimeout: 30000,
  },
});
