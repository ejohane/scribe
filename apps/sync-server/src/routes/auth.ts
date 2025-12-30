import { Hono } from 'hono';
import type { Env } from '../types.js';
import { SyncQueries } from '../db/queries.js';
import { hashApiKey, generateApiKey } from '../middleware/auth.js';

export const authRoutes = new Hono<{ Bindings: Env }>();

interface RegisterRequest {
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

/**
 * POST /v1/auth/register
 *
 * Create a new user account.
 */
authRoutes.post('/register', async (c) => {
  const body = await c.req.json<RegisterRequest>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  // Basic email validation
  if (!body.email.includes('@')) {
    return c.json({ error: 'Invalid email format' }, 400);
  }

  // Password requirements
  if (body.password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  const queries = new SyncQueries(c.env.DB);

  // Check if user already exists
  const existingUser = await queries.getUserByEmail(body.email);
  if (existingUser) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  try {
    // Generate user ID and API key
    const userId = crypto.randomUUID();
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);

    // Create user (store password hash in a separate field if needed for login)
    // For v1, we'll use the API key hash as the main auth method
    await queries.createUser(userId, body.email, apiKeyHash);

    // Also store password hash for login (would need schema update)
    // For now, API key is the only auth method

    return c.json(
      {
        success: true,
        userId,
        apiKey, // Return the API key once - user must save it
        message: 'Save your API key securely - it cannot be retrieved later',
      },
      201
    );
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({ error: 'Registration failed' }, 500);
  }
});

/**
 * POST /v1/auth/login
 *
 * Login and get a new API key (regenerates the key).
 * For v1, we use email + existing API key to regenerate.
 */
authRoutes.post('/login', async (c) => {
  const body = await c.req.json<LoginRequest>();

  if (!body.email || !body.password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  const queries = new SyncQueries(c.env.DB);

  // For v1, password is actually the API key
  // A proper implementation would verify against stored password hash
  const apiKeyHash = await hashApiKey(body.password);

  // Look up user by email
  const user = await queries.getUserByEmail(body.email);
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Verify API key
  if (user.api_key_hash !== apiKeyHash) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  return c.json({
    success: true,
    userId: user.id,
    email: user.email,
    message: 'Authentication successful',
  });
});

/**
 * POST /v1/auth/regenerate
 *
 * Generate a new API key (requires current API key).
 */
authRoutes.post('/regenerate', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization required' }, 401);
  }

  const currentApiKey = authHeader.slice(7);

  if (!c.env.DB) {
    return c.json({ error: 'Database not configured' }, 500);
  }

  try {
    const currentHash = await hashApiKey(currentApiKey);

    // Verify current API key
    const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE api_key_hash = ?')
      .bind(currentHash)
      .first<{ id: string; email: string }>();

    if (!user) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    // Generate new API key
    const newApiKey = generateApiKey();
    const newApiKeyHash = await hashApiKey(newApiKey);

    // Update user's API key hash
    await c.env.DB.prepare('UPDATE users SET api_key_hash = ? WHERE id = ?')
      .bind(newApiKeyHash, user.id)
      .run();

    return c.json({
      success: true,
      apiKey: newApiKey,
      message: 'API key regenerated - save your new key securely',
    });
  } catch (error) {
    console.error('Regenerate error:', error);
    return c.json({ error: 'Failed to regenerate API key' }, 500);
  }
});
