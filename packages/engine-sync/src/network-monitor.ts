/**
 * Platform-agnostic network status monitor interface.
 *
 * Implementations are provided by the host application:
 * - Desktop: Uses Electron's net module
 * - Web: Uses navigator.onLine + online/offline events
 * - Mobile: Uses platform-specific APIs
 */
export interface INetworkMonitor {
  /** Check if currently online */
  isOnline(): boolean;

  /** Subscribe to network status changes */
  onStatusChange(callback: (online: boolean) => void): () => void;

  /** Clean up resources */
  destroy(): void;
}

/**
 * Null implementation for when sync is disabled.
 * Always reports offline, never fires events.
 */
export class DisabledNetworkMonitor implements INetworkMonitor {
  isOnline(): boolean {
    return false;
  }

  onStatusChange(_callback: (online: boolean) => void): () => void {
    return () => {}; // No-op unsubscribe
  }

  destroy(): void {
    // Nothing to clean up
  }
}

/**
 * Simple in-memory network monitor for testing or simple use cases.
 * Can be manually controlled via setOnline().
 */
export class SimpleNetworkMonitor implements INetworkMonitor {
  private online: boolean;
  private listeners: Set<(online: boolean) => void> = new Set();

  constructor(initialOnline: boolean = true) {
    this.online = initialOnline;
  }

  isOnline(): boolean {
    return this.online;
  }

  setOnline(online: boolean): void {
    if (this.online !== online) {
      this.online = online;
      for (const listener of this.listeners) {
        listener(online);
      }
    }
  }

  onStatusChange(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  destroy(): void {
    this.listeners.clear();
  }
}
