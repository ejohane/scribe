import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['src/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          d1Databases: {
            DB: 'test-db',
          },
          kvNamespaces: {
            RATE_LIMIT: 'test-kv',
          },
        },
      },
    },
  },
});
