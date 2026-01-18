import { happyDomConfig, mergeConfig, defineConfig } from '../../config/vitest/base';

export default mergeConfig(
  happyDomConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['./src/test/setup.ts'],
    },
  })
);
