import { nodeConfig, mergeConfig, defineConfig } from '../../../../config/vitest/base';

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      coverage: {
        // Preload has simpler coverage needs
        thresholds: undefined,
      },
    },
  })
);
