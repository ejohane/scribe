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
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  })
);
