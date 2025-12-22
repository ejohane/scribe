/**
 * Shared Vitest Configuration Presets
 *
 * This module provides reusable vitest configuration presets to eliminate
 * duplication across the monorepo. Each package can extend these base
 * configurations and customize as needed.
 *
 * @example
 * ```typescript
 * // packages/shared/vitest.config.ts
 * import { nodeConfig } from '../../config/vitest/base';
 * export default nodeConfig;
 *
 * // With customization:
 * import { mergeConfig } from 'vitest/config';
 * import { nodeConfig } from '../../config/vitest/base';
 * export default mergeConfig(nodeConfig, {
 *   test: { setupFiles: ['./tests/setup.ts'] },
 * });
 * ```
 */

import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Standard coverage thresholds for packages.
 * CLI and renderer may have different thresholds.
 */
const packageCoverageThresholds = {
  lines: 60,
  functions: 60,
  branches: 60,
  statements: 60,
};

/**
 * Base configuration shared by all test environments.
 * Provides common settings like globals and coverage defaults.
 */
export const baseConfig = defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['node_modules/', 'src/**/*.test.ts', '**/*.d.ts'],
    },
  },
});

/**
 * Configuration preset for Node.js environment packages.
 * Use this for pure TypeScript packages that don't need DOM.
 *
 * Packages using this:
 * - @scribe/shared
 * - @scribe/engine-core
 * - @scribe/engine-graph
 * - @scribe/engine-search
 * - @scribe/storage-fs
 */
export const nodeConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: 'node',
      coverage: {
        thresholds: packageCoverageThresholds,
      },
    },
  })
);

/**
 * Configuration preset for happy-dom environment.
 * Use this for React/browser packages that need DOM mocking.
 *
 * Packages using this:
 * - @scribe/design-system
 */
export const happyDomConfig = mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      coverage: {
        exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*', '**/dist/'],
      },
    },
  })
);

// Re-export utilities for convenience
export { mergeConfig, defineConfig };
