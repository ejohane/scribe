import react from '@vitejs/plugin-react';
import path from 'path';
import { happyDomConfig, mergeConfig, defineConfig } from '../../config/vitest/base';

export default mergeConfig(
  happyDomConfig,
  defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      setupFiles: ['./src/test/setup.ts'],
    },
  })
);
