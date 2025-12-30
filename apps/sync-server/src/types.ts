/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  /** D1 database binding */
  DB?: D1Database;
  /** KV namespace for rate limiting */
  RATE_LIMIT?: KVNamespace;
  /** Environment name */
  ENVIRONMENT: 'development' | 'staging' | 'production';
  /** JWT secret for auth */
  JWT_SECRET?: string;
}
