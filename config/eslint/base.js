import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
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
      // Discourage direct console usage - prefer logger abstraction
      // Use `// eslint-disable-next-line no-console -- <reason>` for valid exceptions
      'no-console': 'warn',
    },
  },
  // Allow console in logger implementations (they wrap console calls)
  {
    files: ['**/logger.ts', '**/logger.js'],
    rules: {
      'no-console': 'off',
    },
  },
  // Allow console in scripts (standalone utilities)
  {
    files: ['**/scripts/**/*.ts', '**/scripts/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  // Allow console in test files (mocking, assertions, debugging)
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**/*.ts', '**/tests/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  },
];
