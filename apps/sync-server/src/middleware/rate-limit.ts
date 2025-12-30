import { createMiddleware } from 'hono/factory';
import type { Env } from '../types.js';
import type { AuthContext } from './auth.js';

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Identifier for rate limit group (e.g., 'push', 'pull') */
  group: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 100,
  windowSeconds: 60,
  group: 'default',
};

/**
 * Rate limiting middleware using Cloudflare KV.
 *
 * Tracks requests per user/IP with a sliding window approach.
 * Returns 429 Too Many Requests when limit is exceeded.
 */
export const rateLimitMiddleware = (config: Partial<RateLimitConfig> = {}) => {
  const { limit, windowSeconds, group } = { ...DEFAULT_CONFIG, ...config };

  return createMiddleware<{
    Bindings: Env;
    Variables: { auth?: AuthContext };
  }>(async (c, next) => {
    // Skip rate limiting in development or if KV not configured
    if (c.env.ENVIRONMENT === 'development' || !c.env.RATE_LIMIT) {
      return next();
    }

    // Get identifier (prefer user ID from auth, fallback to IP)
    const auth = c.get('auth');
    const identifier = auth?.userId ?? c.req.header('CF-Connecting-IP') ?? 'unknown';

    // Build rate limit key
    const windowStart = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `ratelimit:${group}:${identifier}:${windowStart}`;

    try {
      // Get current count
      const currentStr = await c.env.RATE_LIMIT.get(key);
      const current = currentStr ? parseInt(currentStr, 10) : 0;

      if (current >= limit) {
        // Calculate retry-after
        const retryAfter = Math.ceil((windowStart + 1) * windowSeconds - Date.now() / 1000);

        c.header('Retry-After', String(retryAfter));
        c.header('X-RateLimit-Limit', String(limit));
        c.header('X-RateLimit-Remaining', '0');
        c.header('X-RateLimit-Reset', String((windowStart + 1) * windowSeconds));

        return c.json(
          {
            error: 'Rate limit exceeded',
            retryAfter,
          },
          429
        );
      }

      // Increment counter
      await c.env.RATE_LIMIT.put(key, String(current + 1), {
        expirationTtl: windowSeconds * 2, // Keep for 2 windows for safety
      });

      // Set rate limit headers
      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Remaining', String(limit - current - 1));
      c.header('X-RateLimit-Reset', String((windowStart + 1) * windowSeconds));

      return next();
    } catch (error) {
      // On KV error, allow request but log
      console.error('Rate limit KV error:', error);
      return next();
    }
  });
};

/**
 * Stricter rate limit for push operations (sync writes).
 */
export const pushRateLimitMiddleware = () =>
  rateLimitMiddleware({
    limit: 60, // 60 pushes per minute
    windowSeconds: 60,
    group: 'push',
  });

/**
 * More lenient rate limit for pull operations (sync reads).
 */
export const pullRateLimitMiddleware = () =>
  rateLimitMiddleware({
    limit: 120, // 120 pulls per minute
    windowSeconds: 60,
    group: 'pull',
  });

/**
 * Very strict rate limit for auth operations.
 */
export const authRateLimitMiddleware = () =>
  rateLimitMiddleware({
    limit: 10, // 10 auth attempts per 5 minutes
    windowSeconds: 300,
    group: 'auth',
  });
