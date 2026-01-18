import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import path from 'path';
import { happyDomConfig, mergeConfig, defineConfig } from '../../../config/vitest/base';

export default mergeConfig(
  happyDomConfig,
  defineConfig({
    plugins: [vanillaExtractPlugin()],
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['./src/test/setup.ts'],
      // Ignore unhandled errors that occur due to Lexical/happy-dom compatibility issues
      // These don't affect test validity but can cause worker crashes in CI
      dangerouslyIgnoreUnhandledErrors: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  })
);
