const { configDefaults, defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '**/*.acceptance.test.js'],
    globals: true,
    testTimeout: 30000,
  },
});
