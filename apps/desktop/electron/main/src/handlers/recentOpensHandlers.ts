/**
 * Recent Opens IPC Handlers
 *
 * Handles IPC communication for recent opens tracking.
 * Uses "best effort" approach - failures are logged but don't throw.
 */

import { ipcMain } from 'electron';
import type { RecentOpenEntityType } from '@scribe/shared';
import { IPC_CHANNELS } from '@scribe/shared';
import type { HandlerDependencies } from './types';

const VALID_ENTITY_TYPES = ['note', 'meeting', 'person', 'daily'] as const;

function isValidEntityType(type: unknown): type is RecentOpenEntityType {
  return typeof type === 'string' && VALID_ENTITY_TYPES.includes(type as RecentOpenEntityType);
}

/**
 * Setup IPC handlers for recent opens operations.
 *
 * All handlers use "best effort" semantics:
 * - Recording opens should never block navigation
 * - Failed operations are logged but don't throw
 * - Missing database returns empty/false instead of throwing
 */
export function setupRecentOpensHandlers(deps: HandlerDependencies): void {
  ipcMain.handle(
    IPC_CHANNELS.RECENT_OPENS_RECORD,
    async (_event, entityId: string, entityType: RecentOpenEntityType) => {
      if (!entityId || typeof entityId !== 'string') {
        console.error('Invalid entityId for recent opens record');
        return { success: false };
      }
      if (!isValidEntityType(entityType)) {
        console.error(`Invalid entityType: ${entityType}`);
        return { success: false };
      }

      try {
        if (!deps.recentOpensDb) {
          console.warn('Recent opens database not initialized');
          return { success: false };
        }
        deps.recentOpensDb.recordOpen(entityId, entityType);
        return { success: true };
      } catch (error) {
        console.error('Failed to record open:', error);
        return { success: false };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.RECENT_OPENS_GET, async (_event, limit?: number) => {
    if (!deps.recentOpensDb) {
      return [];
    }
    try {
      return deps.recentOpensDb.getRecent(limit ?? 10);
    } catch (error) {
      console.error('Failed to get recent opens:', error);
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.RECENT_OPENS_REMOVE, async (_event, entityId: string) => {
    try {
      if (!deps.recentOpensDb) {
        return { success: false };
      }
      deps.recentOpensDb.removeTracking(entityId);
      return { success: true };
    } catch (error) {
      console.error('Failed to remove tracking:', error);
      return { success: false };
    }
  });
}
