import { Hono } from 'hono';
import type { Env } from '../types.js';
import type { SyncPushRequest, SyncPushResponse } from '@scribe/shared';
import { SyncQueries } from '../db/queries.js';
import type { AuthContext } from '../middleware/auth.js';

export const pushRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

/**
 * POST /v1/sync/push
 *
 * Receives local changes and applies them to server.
 * Returns per-change success/failure with new versions.
 */
pushRoute.post('/push', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<SyncPushRequest>();

  if (!body.deviceId || !body.changes || !Array.isArray(body.changes)) {
    return c.json({ error: 'Invalid request: deviceId and changes array required' }, 400);
  }

  if (body.changes.length > 100) {
    return c.json({ error: 'Too many changes (max 100)' }, 400);
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  const queries = new SyncQueries(c.env.DB);

  // Ensure device is registered
  await queries.upsertDevice(body.deviceId, auth.userId);

  const accepted: SyncPushResponse['accepted'] = [];
  const conflicts: SyncPushResponse['conflicts'] = [];
  const errors: SyncPushResponse['errors'] = [];

  for (const change of body.changes) {
    try {
      // Get current server version
      const existingNote = await queries.getNote(auth.userId, change.noteId);
      const serverVersion = existingNote?.version ?? 0;

      // Check for version conflict
      if (change.baseVersion !== undefined && change.baseVersion < serverVersion) {
        // Conflict: server has newer version
        const serverContent = existingNote?.content ? JSON.parse(existingNote.content) : null;
        conflicts.push({
          noteId: change.noteId,
          serverVersion,
          serverNote: serverContent,
        });
        continue;
      }

      // Process the change
      const newVersion = serverVersion + 1;

      if (change.operation === 'delete') {
        await queries.softDeleteNote(auth.userId, change.noteId, newVersion);
      } else if (change.payload) {
        const noteType = (change.payload as Record<string, unknown>)?.type ?? null;
        await queries.upsertNote(
          auth.userId,
          change.noteId,
          newVersion,
          change.contentHash ?? '',
          JSON.stringify(change.payload),
          typeof noteType === 'string' ? noteType : undefined
        );
      }

      // Log the change
      const sequence = await queries.appendChangeLog(
        auth.userId,
        change.noteId,
        body.deviceId,
        change.operation,
        newVersion,
        change.contentHash
      );

      accepted.push({
        noteId: change.noteId,
        serverVersion: newVersion,
        serverSequence: sequence,
      });
    } catch (error) {
      errors.push({
        noteId: change.noteId,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      });
    }
  }

  const response: SyncPushResponse = {
    accepted,
    conflicts,
    errors,
  };

  return c.json(response);
});
