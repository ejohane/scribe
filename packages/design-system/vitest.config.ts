import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { happyDomConfig, mergeConfig, defineConfig } from '../../config/vitest/base';

export default mergeConfig(
  happyDomConfig,
  defineConfig({
    plugins: [vanillaExtractPlugin()],
    test: {
      setupFiles: ['./src/test/setup.ts'],
    },
  })
);
