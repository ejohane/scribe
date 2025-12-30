# @scribe/sync-server

Sync server for Scribe, deployed on Cloudflare Workers.

## Development

```bash
# Start local dev server
bun run dev

# Deploy to staging
bun run deploy:staging

# Deploy to production
bun run deploy
```

## Endpoints

- `GET /health` - Health check
- `GET /v1/sync/status` - Server status
- `POST /v1/sync/push` - Push local changes (auth required)
- `POST /v1/sync/pull` - Pull remote changes (auth required)

## Database

Uses Cloudflare D1 (SQLite). See migrations in `src/db/migrations/`.
