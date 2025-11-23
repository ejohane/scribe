import baseConfig from '@scribe/eslint-config/base.js';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
  },
];
