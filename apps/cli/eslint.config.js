import baseConfig from '@scribe/eslint-config/base.js';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      // CLI uses console for user output - this is intentional
      'no-console': 'off',
    },
  },
  {
    ignores: ['scribe'],
  },
];
