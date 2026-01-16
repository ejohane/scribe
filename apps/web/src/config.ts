/**
 * Configuration for Scribe Web client
 *
 * Environment variables can be set via:
 * - .env file in the web package
 * - VITE_* environment variables at build time
 */

/**
 * Port for connecting to the Scribe daemon.
 *
 * In a browser environment, we can't read ~/.scribe/daemon.json,
 * so the port must be configured via environment variable or
 * passed directly to ScribeProvider.
 *
 * Set via VITE_DAEMON_PORT environment variable.
 *
 * @default 47832 - The default Scribe daemon port
 */
export const DAEMON_PORT = parseInt(import.meta.env.VITE_DAEMON_PORT ?? '47832', 10);

/**
 * Host for connecting to the Scribe daemon.
 *
 * Almost always localhost/127.0.0.1 since the daemon runs locally.
 * Set via VITE_DAEMON_HOST environment variable.
 *
 * @default '127.0.0.1'
 */
export const DAEMON_HOST = import.meta.env.VITE_DAEMON_HOST ?? '127.0.0.1';
