import { Hono } from 'hono';
import type { Env } from '../types.js';
import type { SyncPullRequest, SyncPullResponse } from '@scribe/shared';
import { SyncQueries } from '../db/queries.js';
import type { AuthContext } from '../middleware/auth.js';

export const pullRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

/**
 * POST /v1/sync/pull
 *
 * Returns changes since the given sequence number.
 * Used for incremental sync after initial sync.
 */
pullRoute.post('/pull', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<SyncPullRequest>();

  if (!body.deviceId) {
    return c.json({ error: 'deviceId required' }, 400);
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  const queries = new SyncQueries(c.env.DB);

  // Ensure device is registered
  await queries.upsertDevice(body.deviceId, auth.userId);

  const sinceSequence = body.sinceSequence ?? 0;
  const limit = Math.min(body.limit ?? 100, 1000); // Cap at 1000

  // Get changes from change log
  const changeLogEntries = await queries.getChangesSince(
    auth.userId,
    sinceSequence,
    limit + 1 // Fetch one extra to check hasMore
  );

  const hasMore = changeLogEntries.length > limit;
  const entriesToReturn = hasMore ? changeLogEntries.slice(0, limit) : changeLogEntries;

  // Build response with full note content for creates/updates
  const changes: SyncPullResponse['changes'] = [];

  for (const entry of entriesToReturn) {
    let note: unknown = undefined;

    if (entry.operation !== 'delete') {
      const noteContent = await queries.getNoteContent(auth.userId, entry.note_id);
      if (noteContent) {
        try {
          note = JSON.parse(noteContent);
        } catch {
          // Invalid JSON in DB, skip this note
          continue;
        }
      }
    }

    changes.push({
      noteId: entry.note_id,
      operation: entry.operation,
      version: entry.version,
      serverSequence: entry.sequence,
      note,
      timestamp: new Date(entry.created_at).toISOString(),
    });
  }

  // Get latest sequence for this user
  const latestSequence = await queries.getLatestSequence(auth.userId);

  const response: SyncPullResponse = {
    changes,
    hasMore,
    latestSequence,
    serverTime: new Date().toISOString(),
  };

  return c.json(response);
});
