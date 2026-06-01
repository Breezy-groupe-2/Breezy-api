const nodeGlobals = {
  Buffer: 'readonly',
  console: 'readonly',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
};

const testGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  test: 'readonly',
  vi: 'readonly',
};

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', 'build/**'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'prefer-const': 'warn',
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        ...testGlobals,
      },
    },
  },
];
