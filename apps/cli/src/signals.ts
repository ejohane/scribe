/**
 * Signal handling for graceful CLI shutdown
 *
 * Handles SIGINT (Ctrl+C) and SIGTERM signals to ensure:
 * - Clean exit with correct exit codes
 * - Proper cleanup of any temporary files
 * - No partial output on interrupt
 */

/**
 * Exit code for SIGINT (Ctrl+C)
 * Standard convention: 128 + signal number (SIGINT = 2)
 */
export const SIGINT_EXIT_CODE = 130;

/**
 * Exit code for SIGTERM
 * Standard convention: 128 + signal number (SIGTERM = 15)
 */
export const SIGTERM_EXIT_CODE = 143;

/**
 * Track whether signal handlers have been set up
 * to prevent duplicate registration
 */
let handlersRegistered = false;

/**
 * Callback type for custom cleanup functions
 */
export type CleanupCallback = () => void | Promise<void>;

/**
 * Registry of cleanup callbacks to run on shutdown
 */
const cleanupCallbacks: Set<CleanupCallback> = new Set();

/**
 * Register a cleanup callback to run when the CLI receives a termination signal.
 * Callbacks are executed in the order they were registered.
 *
 * @param callback - Function to run on cleanup
 * @returns Unregister function to remove the callback
 */
export function registerCleanupCallback(callback: CleanupCallback): () => void {
  cleanupCallbacks.add(callback);
  return () => cleanupCallbacks.delete(callback);
}

/**
 * Run all registered cleanup callbacks
 * Logs errors but continues with remaining callbacks
 */
async function runCleanupCallbacks(): Promise<void> {
  for (const callback of cleanupCallbacks) {
    try {
      await callback();
    } catch {
      // Silently ignore cleanup errors during shutdown
      // We're exiting anyway, and logging could interfere with output
    }
  }
}

/**
 * Set up signal handlers for graceful shutdown.
 *
 * This function should be called early in CLI initialization.
 * It registers handlers for:
 * - SIGINT (Ctrl+C): Exit with code 130
 * - SIGTERM: Exit with code 143
 *
 * The handlers will:
 * 1. Run any registered cleanup callbacks
 * 2. Exit with the appropriate exit code
 *
 * Safe to call multiple times - handlers are only registered once.
 */
export function setupSignalHandlers(): void {
  // Prevent duplicate registration
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    // Run cleanup then exit
    runCleanupCallbacks()
      .finally(() => {
        process.exit(SIGINT_EXIT_CODE);
      })
      .catch(() => {
        // Should never reach here, but exit anyway
        process.exit(SIGINT_EXIT_CODE);
      });
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    // Run cleanup then exit
    runCleanupCallbacks()
      .finally(() => {
        process.exit(SIGTERM_EXIT_CODE);
      })
      .catch(() => {
        // Should never reach here, but exit anyway
        process.exit(SIGTERM_EXIT_CODE);
      });
  });
}
