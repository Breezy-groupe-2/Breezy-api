const { defineConfig } = require('vitest/config');
module.exports = defineConfig({
  test: { environment: 'node', globals: true, testTimeout: 300000, hookTimeout: 300000 },
});
