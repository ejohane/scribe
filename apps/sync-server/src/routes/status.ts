import { Hono } from 'hono';
import type { Env } from '../types.js';
import type { AuthContext } from '../middleware/auth.js';

export const statusRoute = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

/**
 * GET /v1/sync/status
 *
 * Returns server status and user info.
 * Requires authentication.
 */
statusRoute.get('/status', async (c) => {
  const auth = c.get('auth');

  return c.json({
    ok: true,
    serverTime: new Date().toISOString(),
    user: {
      id: auth.userId,
      email: auth.email,
    },
    version: '1.0.0',
  });
});

/**
 * GET /v1/sync/stats
 *
 * Returns sync statistics for the user.
 * Requires authentication.
 */
statusRoute.get('/stats', async (c) => {
  const auth = c.get('auth');

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  try {
    // Get user stats
    const stats = await c.env.DB.prepare(
      `
      SELECT 
        (SELECT COUNT(*) FROM notes WHERE user_id = ? AND deleted_at IS NULL) as noteCount,
        (SELECT COUNT(*) FROM devices WHERE user_id = ?) as deviceCount,
        (SELECT MAX(sequence) FROM change_log WHERE user_id = ?) as latestSequence
    `
    )
      .bind(auth.userId, auth.userId, auth.userId)
      .first<{
        noteCount: number;
        deviceCount: number;
        latestSequence: number | null;
      }>();

    return c.json({
      ok: true,
      serverTime: new Date().toISOString(),
      stats: {
        noteCount: stats?.noteCount ?? 0,
        deviceCount: stats?.deviceCount ?? 0,
        latestSequence: stats?.latestSequence ?? 0,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to get stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});
