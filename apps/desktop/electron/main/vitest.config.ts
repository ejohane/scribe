import { nodeConfig, mergeConfig, defineConfig } from '../../../../config/vitest/base';

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      // Include test files in src directory
      include: ['src/**/*.test.ts'],
      // Exclude integration tests
      exclude: ['**/*.integration.test.ts'],
      // Use vitest's built-in mocking instead of Bun's
      environment: 'node',
      // Pass with no tests (infrastructure tests removed during thin shell refactor)
      passWithNoTests: true,
      coverage: {
        // electron/main has simpler coverage needs
        thresholds: undefined,
      },
    },
  })
);
