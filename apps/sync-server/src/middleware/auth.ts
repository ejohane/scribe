import { createMiddleware } from 'hono/factory';
import type { Env } from '../types.js';

export interface AuthContext {
  userId: string;
  email: string;
}

/**
 * Auth middleware that validates API key via Bearer token.
 *
 * For v1, we use a simple API key approach (not JWT).
 * The API key hash is stored in the users table and verified via PBKDF2.
 *
 * Expects Authorization header: "Bearer <api_key>"
 * Sets c.get('auth') with user info on success.
 */
export const authMiddleware = () => {
  return createMiddleware<{ Bindings: Env; Variables: { auth: AuthContext } }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const apiKey = authHeader.slice(7);

    if (!apiKey) {
      return c.json({ error: 'Missing API key' }, 401);
    }

    // For v1, we'll validate the API key against stored hashes
    // This requires a database lookup
    // For now, just check format and pass through
    // Full implementation will be in auth endpoints task

    try {
      // Hash the provided API key and look up in database
      const apiKeyHash = await hashApiKey(apiKey);

      // This will be replaced with actual DB lookup
      // For now, set a placeholder auth context
      if (!c.env.DB) {
        // No DB configured - development mode, allow any key
        c.set('auth', {
          userId: 'dev-user',
          email: 'dev@localhost',
        });
        return next();
      }

      // Look up user by API key hash
      const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE api_key_hash = ?')
        .bind(apiKeyHash)
        .first<{ id: string; email: string }>();

      if (!user) {
        return c.json({ error: 'Invalid API key' }, 401);
      }

      c.set('auth', {
        userId: user.id,
        email: user.email,
      });

      await next();
    } catch (error) {
      console.error('Auth error:', error);
      return c.json({ error: 'Authentication failed' }, 401);
    }
  });
};

/**
 * Hash an API key using SHA-256.
 * For v1, we use a simple hash. In production, use PBKDF2 with salt.
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password using PBKDF2.
 * Workers-compatible alternative to bcrypt.
 */
export async function hashPassword(password: string, salt?: Uint8Array): Promise<string> {
  const actualSalt = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: actualSalt, iterations, hash: 'SHA-256' },
    key,
    256
  );

  const hash = new Uint8Array(bits);

  // Format: iterations$salt$hash (all hex encoded)
  const saltHex = Array.from(actualSalt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const hashHex = Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${iterations}$${saltHex}$${hashHex}`;
}

/**
 * Verify a password against a stored PBKDF2 hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [iterationsStr, saltHex, expectedHashHex] = storedHash.split('$');

  if (!iterationsStr || !saltHex || !expectedHashHex) {
    return false;
  }

  const iterations = parseInt(iterationsStr, 10);

  // Decode salt from hex
  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);

  // Hash the provided password with the same salt
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256
  );

  const actualHash = new Uint8Array(bits);
  const actualHashHex = Array.from(actualHash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (actualHashHex.length !== expectedHashHex.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < actualHashHex.length; i++) {
    diff |= actualHashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  }

  return diff === 0;
}

/**
 * Generate a random API key.
 */
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
