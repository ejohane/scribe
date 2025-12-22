import { nodeConfig, mergeConfig, defineConfig } from '../../config/vitest/base';

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.test.ts'],
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        include: ['src/**/*.ts'],
        exclude: ['src/index.ts', 'src/cli.ts'],
        // Override thresholds - CLI has different coverage needs
        thresholds: undefined,
      },
    },
  })
);
