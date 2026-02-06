import { defineConfig, mergeConfig, nodeConfig } from '../../config/vitest/base';

const isBun = Boolean(process.versions?.bun);

export default mergeConfig(
  nodeConfig,
  defineConfig({
    test: isBun
      ? {
          include: ['src/utils.test.ts'],
        }
      : {},
  })
);
