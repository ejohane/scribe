## Summary

Create the main process IPC handlers that receive asset operations from the renderer and delegate to AssetManager. This bridges the Electron IPC layer to the storage layer.

## Context & Rationale

### Handler Pattern in Scribe
Scribe organizes IPC handlers by domain in separate files:
- `apps/desktop/electron/main/src/handlers/noteHandlers.ts`
- `apps/desktop/electron/main/src/handlers/syncHandlers.ts`
- etc.

Each handler file:
1. Imports the IPC channel names from shared
2. Registers handlers using `ipcMain.handle()`
3. Delegates to appropriate service (NoteStore, SyncEngine, etc.)

### Architecture
```
Renderer                    Main Process
-----------------------------------------------------
ipcRenderer.invoke() -------> ipcMain.handle()
  "assets:save"                 |
  ArrayBuffer                   v
                            assetHandlers.ts
                                |
                                v
                            AssetManager.save()
                                |
                                v
                            vault/assets/
```

## Implementation

### File Location
`apps/desktop/electron/main/src/handlers/assetHandlers.ts`

### Code Implementation
```typescript
/**
 * Asset IPC Handlers
 * 
 * Handles binary asset operations (images) between renderer and storage.
 * Follows the established pattern from noteHandlers.ts.
 */

import { ipcMain } from "electron";
import type { VaultPath } from "@scribe/shared";
import { IPC_CHANNELS, type AssetSaveResult } from "@scribe/shared";
import { AssetManager } from "@scribe/storage-fs";
import { createLogger } from "@scribe/shared";

const log = createLogger({ prefix: "assetHandlers" });

/**
 * Register all asset-related IPC handlers
 * 
 * @param vaultPath - Path to the vault directory
 * @returns Cleanup function to remove handlers
 */
export function setupAssetHandlers(vaultPath: VaultPath): () => void {
  const assetManager = new AssetManager(vaultPath);
  
  // ASSETS_SAVE - Save binary data as asset
  ipcMain.handle(
    IPC_CHANNELS.ASSETS_SAVE,
    async (
      _event,
      data: ArrayBuffer,
      mimeType: string,
      _filename?: string
    ): Promise<AssetSaveResult> => {
      log.debug("Saving asset", { mimeType, size: data.byteLength });
      
      try {
        // Convert ArrayBuffer to Node.js Buffer
        const buffer = Buffer.from(data);
        const result = await assetManager.save(buffer, mimeType);
        
        if (result.success) {
          log.info("Asset saved", { assetId: result.assetId, ext: result.ext });
        } else {
          log.warn("Asset save failed", { error: result.error });
        }
        
        return result;
      } catch (error) {
        const err = error as Error;
        log.error("Asset save error", { error: err.message });
        return {
          success: false,
          error: `Unexpected error: ${err.message}`,
        };
      }
    }
  );

  // ASSETS_LOAD - Load asset binary data
  ipcMain.handle(
    IPC_CHANNELS.ASSETS_LOAD,
    async (_event, assetId: string): Promise<ArrayBuffer | null> => {
      log.debug("Loading asset", { assetId });
      
      try {
        const buffer = await assetManager.load(assetId);
        
        if (buffer) {
          log.debug("Asset loaded", { assetId, size: buffer.byteLength });
          // Convert Buffer to ArrayBuffer for IPC transfer
          return buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          );
        } else {
          log.debug("Asset not found", { assetId });
          return null;
        }
      } catch (error) {
        const err = error as Error;
        log.error("Asset load error", { assetId, error: err.message });
        return null;
      }
    }
  );

  // ASSETS_DELETE - Delete an asset
  ipcMain.handle(
    IPC_CHANNELS.ASSETS_DELETE,
    async (_event, assetId: string): Promise<boolean> => {
      log.debug("Deleting asset", { assetId });
      
      try {
        const deleted = await assetManager.delete(assetId);
        
        if (deleted) {
          log.info("Asset deleted", { assetId });
        } else {
          log.debug("Asset not found for deletion", { assetId });
        }
        
        return deleted;
      } catch (error) {
        const err = error as Error;
        log.error("Asset delete error", { assetId, error: err.message });
        return false;
      }
    }
  );

  // ASSETS_GET_PATH - Get filesystem path
  ipcMain.handle(
    IPC_CHANNELS.ASSETS_GET_PATH,
    async (_event, assetId: string): Promise<string | null> => {
      log.debug("Getting asset path", { assetId });
      
      try {
        const assetPath = await assetManager.getPath(assetId);
        
        if (assetPath) {
          log.debug("Asset path found", { assetId, path: assetPath });
        }
        
        return assetPath;
      } catch (error) {
        const err = error as Error;
        log.error("Asset getPath error", { assetId, error: err.message });
        return null;
      }
    }
  );

  // Cleanup function
  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.ASSETS_SAVE);
    ipcMain.removeHandler(IPC_CHANNELS.ASSETS_LOAD);
    ipcMain.removeHandler(IPC_CHANNELS.ASSETS_DELETE);
    ipcMain.removeHandler(IPC_CHANNELS.ASSETS_GET_PATH);
  };
}
```

### IMPORTANT: Update handlers/index.ts

Add the export to `apps/desktop/electron/main/src/handlers/index.ts`:

```typescript
// Add this line with the other handler exports (around line 47-59)
export { setupAssetHandlers } from './assetHandlers';
```

The full export section should look like:
```typescript
export { setupNotesHandlers } from './notesHandlers';
export { setupSearchHandlers } from './searchHandlers';
export { setupGraphHandlers } from './graphHandlers';
export { setupPeopleHandlers } from './peopleHandlers';
export { setupAppHandlers } from './appHandlers';
export { setupDictionaryHandlers } from './dictionaryHandlers';
export { setupDailyHandlers } from './dailyHandlers';
export { setupMeetingHandlers } from './meetingHandlers';
export { setupTasksHandlers } from './tasksHandlers';
export { setupCLIHandlers } from './cliHandlers';
export { setupExportHandlers } from './exportHandlers';
export { setupDialogHandlers } from './dialogHandlers';
export { setupVaultHandlers } from './vaultHandlers';
export { setupSyncHandlers, setupSyncStatusForwarding } from './syncHandlers';
export { setupRecentOpensHandlers } from './recentOpensHandlers';
export { setupAssetHandlers } from './assetHandlers';  // <-- ADD THIS
// ... rest of exports
```

### Call setupAssetHandlers in main.ts

The handlers need to be called during app initialization. Find where other handlers are set up (likely in `apps/desktop/electron/main/src/main.ts` or similar) and add:

```typescript
import { setupAssetHandlers } from './handlers';

// During initialization, after vault path is known:
setupAssetHandlers(vaultPath);
```

## Design Decisions

### ArrayBuffer ↔ Buffer Conversion
- Electron IPC serializes ArrayBuffer correctly
- Node.js fs APIs work with Buffer
- Conversion is zero-copy via typed array views

### Error Handling Strategy
- All errors are caught and logged
- Failed operations return error result, not throw
- Prevents renderer crashes from main process issues

### Logging Levels
- `debug`: All operations (for development)
- `info`: Successful saves/deletes (for audit)
- `warn`: Expected failures (not found, invalid type)
- `error`: Unexpected failures (filesystem errors)

## Files to Create

- `apps/desktop/electron/main/src/handlers/assetHandlers.ts`

## Files to Modify

- `apps/desktop/electron/main/src/handlers/index.ts` - Add export
- Main process entry point (e.g., `main.ts`) - Call setupAssetHandlers

## Testing

### Test File Location
`apps/desktop/electron/main/src/handlers/__tests__/assetHandlers.test.ts`

### Integration Tests
```typescript
import { ipcMain } from "electron";
import { setupAssetHandlers } from "../assetHandlers";
import { IPC_CHANNELS } from "@scribe/shared";
import { initializeVault } from "@scribe/storage-fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

describe("assetHandlers", () => {
  let testDir: string;
  let vaultPath: VaultPath;
  let cleanup: () => void;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "scribe-test-"));
    vaultPath = await initializeVault(createVaultPath(testDir));
    cleanup = setupAssetHandlers(vaultPath);
  });

  afterEach(async () => {
    cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("ASSETS_SAVE", () => {
    it("should save PNG image and return asset ID with ext", async () => {
      // Get the registered handler
      const handler = getHandler(IPC_CHANNELS.ASSETS_SAVE);
      
      const pngData = new ArrayBuffer(4);
      const view = new Uint8Array(pngData);
      view.set([0x89, 0x50, 0x4E, 0x47]); // PNG magic bytes
      
      const result = await handler({}, pngData, "image/png");
      
      expect(result.success).toBe(true);
      expect(result.assetId).toMatch(/^[0-9a-f-]{36}$/);
      expect(result.ext).toBe("png");
    });

    it("should reject unsupported MIME type", async () => {
      const handler = getHandler(IPC_CHANNELS.ASSETS_SAVE);
      
      const result = await handler({}, new ArrayBuffer(10), "application/pdf");
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported");
    });
  });

  describe("ASSETS_GET_PATH", () => {
    it("should return path for saved asset", async () => {
      const saveHandler = getHandler(IPC_CHANNELS.ASSETS_SAVE);
      const getPathHandler = getHandler(IPC_CHANNELS.ASSETS_GET_PATH);
      
      const saveResult = await saveHandler({}, new ArrayBuffer(10), "image/png");
      const assetPath = await getPathHandler({}, saveResult.assetId);
      
      expect(assetPath).toContain(saveResult.assetId);
      expect(assetPath).toEndWith(".png");
    });
  });
});
```

## Acceptance Criteria

- [ ] `assetHandlers.ts` created with all 4 handlers
- [ ] Handlers registered for ASSETS_SAVE, ASSETS_LOAD, ASSETS_DELETE, ASSETS_GET_PATH
- [ ] ArrayBuffer → Buffer conversion working
- [ ] Cleanup function removes all handlers
- [ ] `handlers/index.ts` exports `setupAssetHandlers`
- [ ] Main process calls `setupAssetHandlers(vaultPath)` during init
- [ ] Logging at appropriate levels
- [ ] Integration tests pass

## Dependencies

**Depends on**:
- scribe-m7v.2 (AssetManager)
- scribe-m7v.3 (IPC channel names)

**Blocks**:
- scribe-m7v.5 (preload needs handlers registered)

## Notes for Implementer

- Follow the pattern from `noteHandlers.ts` exactly
- The cleanup function is important for hot-reload in development
- Test with real image files, not just empty buffers
- **Don't forget to update index.ts!** This is a common mistake.
