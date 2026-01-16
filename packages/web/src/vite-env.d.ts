/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables
 */
interface ImportMetaEnv {
  /** Port for connecting to the Scribe daemon */
  readonly VITE_DAEMON_PORT?: string;
  /** Host for connecting to the Scribe daemon */
  readonly VITE_DAEMON_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
