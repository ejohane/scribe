/**
 * Vitest configuration for integration tests.
 *
 * Integration tests run against a real daemon and file system,
 * so they require a Node.js environment (not happy-dom).
 */
import { nodeConfig, mergeConfig, defineConfig } from '../../config/vitest/base';

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      include: ['tests/**/*.test.ts'],
      testTimeout: 30000,
      hookTimeout: 30000,
      // Run tests sequentially to avoid port conflicts
      sequence: {
        shuffle: false,
      },
      // Single thread to avoid daemon conflicts
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,
        },
      },
    },
  })
);
