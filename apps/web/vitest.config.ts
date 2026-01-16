import react from '@vitejs/plugin-react';
import { happyDomConfig, mergeConfig, defineConfig } from '../../config/vitest/base';

export default mergeConfig(
  happyDomConfig,
  defineConfig({
    plugins: [react()],
    test: {
      setupFiles: ['./src/test/setup.ts'],
    },
  })
);
