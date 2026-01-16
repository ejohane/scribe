import { mergeConfig, defineConfig } from 'vitest/config';
import { nodeConfig } from '../../config/vitest/base';

// Run tests sequentially to avoid process.env.HOME conflicts
// between daemon and discovery tests
export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      sequence: {
        concurrent: false,
      },
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  })
);
