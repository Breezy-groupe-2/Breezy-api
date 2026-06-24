const { configDefaults, defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.js'],
    exclude: [...configDefaults.exclude, '**/*.acceptance.test.js'],
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
