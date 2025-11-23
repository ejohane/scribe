import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  },
];
