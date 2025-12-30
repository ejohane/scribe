import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types.js';
import { rateLimitMiddleware, authRateLimitMiddleware } from './middleware/rate-limit.js';
import { authMiddleware, type AuthContext } from './middleware/auth.js';
import { pushRoute } from './routes/push.js';
import { pullRoute } from './routes/pull.js';
import { statusRoute } from './routes/status.js';
import { authRoutes } from './routes/auth.js';

const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

// CORS for browser requests
app.use(
  '*',
  cors({
    origin: ['https://scribe.app', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Apply rate limiting to all API routes
app.use('/v1/*', rateLimitMiddleware());

// Auth routes (public with stricter rate limiting)
app.use('/v1/auth/*', authRateLimitMiddleware());
app.route('/v1/auth', authRoutes);

// Apply auth middleware to all sync routes
app.use('/v1/sync/*', authMiddleware());

// Mount sync routes
app.route('/v1/sync', pushRoute);
app.route('/v1/sync', pullRoute);
app.route('/v1/sync', statusRoute);

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default app;
