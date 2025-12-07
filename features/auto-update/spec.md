# Feature: Auto-Update

**Status**: Draft  
**Created**: 2024-12-05  
**GitHub Issue**: TBD

## Overview

Implement automatic application updates for the macOS desktop app. When a new version is released on GitHub, the app will silently download the update in the background and display a subtle notification in the sidebar footer. Users can then restart the app at their convenience to apply the update.

---

## Goals

1. Enable seamless updates without manual DMG downloads
2. Provide a non-intrusive update notification UX
3. Check for updates on startup and periodically while running
4. Allow users to dismiss and defer updates
5. Respect user workflow by never forcing restarts

---

## Non-Goals (Out of Scope)

- Windows/Linux auto-update support
- Multiple release channels (beta, stable)
- Staged/percentage rollouts
- Forced updates for critical versions
- Delta/differential updates
- Rollback functionality
- Update scheduling (e.g., "update tonight")
- In-app changelog display

---

## Architecture Decision: electron-updater with GitHub Releases

The auto-update system uses `electron-updater` with GitHub as the update provider. This approach:

- Leverages existing GitHub Releases infrastructure
- Works with the current semantic-release pipeline
- Requires no additional server infrastructure
- Is the standard approach for Electron apps
- Supports code-signed and notarized macOS builds (already configured)

### Update Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         UPDATE LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  App Launch                                                          │
│      │                                                               │
│      ▼                                                               │
│  ┌──────────────────┐                                               │
│  │ Check for Update │ ◄──── Also runs every 1 hour                  │
│  └────────┬─────────┘                                               │
│           │                                                          │
│           ▼                                                          │
│  ┌──────────────────┐     No update                                 │
│  │ Update Available?│──────────────────► (done, wait for next check)│
│  └────────┬─────────┘                                               │
│           │ Yes                                                      │
│           ▼                                                          │
│  ┌──────────────────┐                                               │
│  │ Download Update  │  (silent, in background)                      │
│  └────────┬─────────┘                                               │
│           │                                                          │
│           ▼                                                          │
│  ┌──────────────────┐                                               │
│  │ Update Ready     │──► Show badge on version number               │
│  └────────┬─────────┘                                               │
│           │                                                          │
│           ▼                                                          │
│  ┌──────────────────┐     Dismiss                                   │
│  │ User Clicks      │──────────────────► (badge persists)           │
│  └────────┬─────────┘                                               │
│           │ "Restart Now"                                            │
│           ▼                                                          │
│  ┌──────────────────┐                                               │
│  │ Quit & Install   │                                               │
│  └──────────────────┘                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Data Structures

### Update State (Renderer)

```typescript
interface UpdateState {
  /** Current update status */
  status: 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
  
  /** Information about available update (when status is 'ready') */
  updateInfo?: {
    version: string;
    releaseDate?: string;
  };
  
  /** Error message if status is 'error' */
  error?: string;
  
  /** Whether the user has dismissed the update popover */
  dismissed: boolean;
}
```

### IPC Events (Main → Renderer)

```typescript
type UpdateEventMap = {
  'update:checking': void;
  'update:available': { version: string; releaseDate?: string };
  'update:not-available': void;
  'update:downloading': { percent: number };
  'update:downloaded': { version: string; releaseDate?: string };
  'update:error': { message: string };
};
```

---

## UI Specifications

### Version Indicator Location

The version indicator is placed in the sidebar footer, to the right of the "Guest User" text:

```
┌─────────────────────────────────────┐
│ Scribe                              │
│ LIBRARY                             │
├─────────────────────────────────────┤
│                                     │
│ + New Note                          │
│                                     │
│ 12-04-2025                          │
│ less than a minute ago              │
│                                     │
│ ... (note list)                     │
│                                     │
├─────────────────────────────────────┤
│ ○ Guest User    v1.12.2        ◐   │
│                     ●              │
└─────────────────────────────────────┘
                      ▲
                      └── Update badge (when ready)
```

### Version Display

| State | Display |
|-------|---------|
| Normal (no update) | `v1.12.2` in muted text |
| Update ready | `v1.12.2` with small dot badge |
| Checking/Downloading | No change (silent) |
| Error | No change (fail silently) |

### Update Badge

- Small circular dot (6-8px diameter)
- Positioned at top-right of version text
- Uses accent/primary color from design system
- Subtle animation: gentle pulse or fade-in on first appearance

### Update Popover

When the user clicks on the version number (when update is ready):

```
┌─────────────────────────────────┐
│ Update Available                │
│                                 │
│ Version 1.13.0 is ready         │
│ to install.                     │
│                                 │
│ ┌─────────────────────────────┐ │
│ │      Restart Now            │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| **Popover** | Appears above the version indicator |
| **"Restart Now" button** | Quits app and installs update |
| **Click outside** | Dismisses popover (update badge persists) |
| **Escape key** | Dismisses popover |

### Dismissal Behavior

- Clicking outside the popover or pressing Escape dismisses it
- The update badge **persists** after dismissal
- User can click version again to re-open the popover
- Badge remains until app is restarted with the update

---

## API Design

### Main Process Module

```typescript
// apps/desktop/electron/main/src/auto-updater.ts

import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow } from 'electron';

interface AutoUpdaterConfig {
  /** Check interval in milliseconds (default: 1 hour) */
  checkInterval?: number;
  /** Whether to auto-download updates (default: true) */
  autoDownload?: boolean;
}

export function setupAutoUpdater(
  mainWindow: BrowserWindow,
  config?: AutoUpdaterConfig
): void;

export function checkForUpdates(): Promise<void>;

export function quitAndInstall(): void;
```

### IPC Handlers

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `update:check` | Renderer → Main | Manually trigger update check |
| `update:install` | Renderer → Main | Quit and install downloaded update |
| `update:checking` | Main → Renderer | Update check started |
| `update:available` | Main → Renderer | Update found, downloading |
| `update:not-available` | Main → Renderer | No update available |
| `update:downloaded` | Main → Renderer | Update ready to install |
| `update:error` | Main → Renderer | Error during update process |

### Preload API

```typescript
// In preload.ts - exposed to renderer
update: {
  /** Manually check for updates */
  check: () => Promise<void>;
  
  /** Quit and install the downloaded update */
  install: () => void;
  
  /** Subscribe to update events */
  onChecking: (callback: () => void) => () => void;
  onAvailable: (callback: (info: { version: string }) => void) => () => void;
  onNotAvailable: (callback: () => void) => () => void;
  onDownloaded: (callback: (info: { version: string }) => void) => () => void;
  onError: (callback: (error: { message: string }) => void) => () => void;
}
```

### TypeScript Declarations

```typescript
// In apps/desktop/renderer/src/types/scribe.d.ts

interface UpdateAPI {
  check(): Promise<void>;
  install(): void;
  onChecking(callback: () => void): () => void;
  onAvailable(callback: (info: { version: string }) => void): () => void;
  onNotAvailable(callback: () => void): () => void;
  onDownloaded(callback: (info: { version: string }) => void): () => void;
  onError(callback: (error: { message: string }) => void): () => void;
}

interface ScribeAPI {
  // Existing...
  notes: NotesAPI;
  search: SearchAPI;
  // ...
  
  // New
  update: UpdateAPI;
}
```

---

## Main Process Implementation

### Auto-Updater Setup

```typescript
// apps/desktop/electron/main/src/auto-updater.ts

import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // Configure logging
  autoUpdater.logger = log;
  
  // Configure update behavior
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Event handlers - forward to renderer
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('update:checking');
  });
  
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });
  
  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update:not-available');
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update:downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
    });
  });
  
  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
    mainWindow.webContents.send('update:error', {
      message: err.message,
    });
  });
  
  // IPC handlers
  ipcMain.handle('update:check', async () => {
    await autoUpdater.checkForUpdates();
  });
  
  ipcMain.on('update:install', () => {
    autoUpdater.quitAndInstall();
  });
  
  // Initial check (delayed to not block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Initial update check failed:', err);
    });
  }, 10000); // 10 second delay
  
  // Periodic checks
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Periodic update check failed:', err);
    });
  }, CHECK_INTERVAL_MS);
}
```

### Integration in main.ts

```typescript
// In createWindow function, after window is ready
import { setupAutoUpdater } from './auto-updater';

// Only enable in production
if (!isDev) {
  setupAutoUpdater(mainWindow);
}
```

---

## Renderer Implementation

### Update Context/Hook

```typescript
// apps/desktop/renderer/src/hooks/useUpdateStatus.ts

import { useState, useEffect, useCallback } from 'react';

interface UpdateStatus {
  status: 'idle' | 'checking' | 'downloading' | 'ready' | 'error';
  version?: string;
  error?: string;
}

export function useUpdateStatus() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ 
    status: 'idle' 
  });
  const [dismissed, setDismissed] = useState(false);
  
  useEffect(() => {
    const unsubChecking = window.scribe.update.onChecking(() => {
      setUpdateStatus({ status: 'checking' });
    });
    
    const unsubAvailable = window.scribe.update.onAvailable((info) => {
      setUpdateStatus({ status: 'downloading', version: info.version });
    });
    
    const unsubNotAvailable = window.scribe.update.onNotAvailable(() => {
      setUpdateStatus({ status: 'idle' });
    });
    
    const unsubDownloaded = window.scribe.update.onDownloaded((info) => {
      setUpdateStatus({ status: 'ready', version: info.version });
      setDismissed(false); // Reset dismissed state for new update
    });
    
    const unsubError = window.scribe.update.onError((error) => {
      setUpdateStatus({ status: 'error', error: error.message });
    });
    
    return () => {
      unsubChecking();
      unsubAvailable();
      unsubNotAvailable();
      unsubDownloaded();
      unsubError();
    };
  }, []);
  
  const installUpdate = useCallback(() => {
    window.scribe.update.install();
  }, []);
  
  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);
  
  return {
    ...updateStatus,
    dismissed,
    installUpdate,
    dismiss,
    hasUpdate: updateStatus.status === 'ready',
  };
}
```

### Version Indicator Component

```typescript
// apps/desktop/renderer/src/components/Sidebar/VersionIndicator.tsx

import { useState, useRef } from 'react';
import { useUpdateStatus } from '../../hooks/useUpdateStatus';
import { UpdatePopover } from './UpdatePopover';
import * as styles from './VersionIndicator.css';

// Get version from package.json at build time
declare const __APP_VERSION__: string;

export function VersionIndicator() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { hasUpdate, version: newVersion, installUpdate, dismiss } = useUpdateStatus();
  
  const handleClick = () => {
    if (hasUpdate) {
      setPopoverOpen(true);
    }
  };
  
  const handleClose = () => {
    setPopoverOpen(false);
    dismiss();
  };
  
  const handleInstall = () => {
    installUpdate();
  };
  
  return (
    <div className={styles.container}>
      <button
        ref={triggerRef}
        className={styles.versionButton}
        onClick={handleClick}
        disabled={!hasUpdate}
        type="button"
      >
        <span className={styles.versionText}>v{__APP_VERSION__}</span>
        {hasUpdate && <span className={styles.updateBadge} />}
      </button>
      
      {popoverOpen && (
        <UpdatePopover
          version={newVersion!}
          triggerRef={triggerRef}
          onClose={handleClose}
          onInstall={handleInstall}
        />
      )}
    </div>
  );
}
```

### Version Indicator Styles

```typescript
// apps/desktop/renderer/src/components/Sidebar/VersionIndicator.css.ts

import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const container = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
});

export const versionButton = style({
  background: 'none',
  border: 'none',
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  cursor: 'default',
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  borderRadius: vars.radius.sm,
  transition: 'background-color 0.15s ease',
  
  selectors: {
    '&:not(:disabled)': {
      cursor: 'pointer',
    },
    '&:not(:disabled):hover': {
      backgroundColor: vars.color.surfaceHover,
    },
  },
});

export const versionText = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  fontFamily: 'inherit',
});

const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.5 },
});

export const updateBadge = style({
  width: '6px',
  height: '6px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.primary,
  animation: `${pulse} 2s ease-in-out infinite`,
});
```

### Update Popover Component

```typescript
// apps/desktop/renderer/src/components/Sidebar/UpdatePopover.tsx

import { useEffect, useRef, RefObject } from 'react';
import { Button } from '@scribe/design-system';
import * as styles from './UpdatePopover.css';

interface UpdatePopoverProps {
  version: string;
  triggerRef: RefObject<HTMLElement>;
  onClose: () => void;
  onInstall: () => void;
}

export function UpdatePopover({ 
  version, 
  triggerRef, 
  onClose, 
  onInstall 
}: UpdatePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, triggerRef]);
  
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  return (
    <div ref={popoverRef} className={styles.popover}>
      <div className={styles.header}>Update Available</div>
      <p className={styles.message}>
        Version {version} is ready to install.
      </p>
      <Button onClick={onInstall} variant="primary" size="sm" fullWidth>
        Restart Now
      </Button>
    </div>
  );
}
```

### Update Popover Styles

```typescript
// apps/desktop/renderer/src/components/Sidebar/UpdatePopover.css.ts

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const popover = style({
  position: 'absolute',
  bottom: '100%',
  right: 0,
  marginBottom: vars.spacing['2'],
  padding: vars.spacing['4'],
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.lg,
  width: '220px',
  zIndex: 100,
});

export const header = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.semibold,
  color: vars.color.foreground,
  marginBottom: vars.spacing['2'],
});

export const message = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  marginBottom: vars.spacing['4'],
  lineHeight: 1.5,
});
```

### Sidebar Footer Integration

```typescript
// In Sidebar.tsx, update the footer section

import { VersionIndicator } from './VersionIndicator';

// In the JSX, after userName:
<div className={styles.footer}>
  <div className={styles.userInfo}>
    <div className={styles.userAvatar} />
    <div className={styles.userName}>Guest User</div>
  </div>
  
  <div className={styles.footerRight}>
    <VersionIndicator />
    <button
      onClick={onThemeToggle}
      className={styles.themeToggle}
      title={currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      type="button"
    >
      {currentTheme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
    </button>
  </div>
</div>
```

---

## Build Configuration Changes

### electron-builder Config

```json
// In apps/desktop/package.json, update build section

{
  "build": {
    "appId": "com.scribe.app",
    "productName": "Scribe",
    "publish": {
      "provider": "github",
      "owner": "OWNER",
      "repo": "REPO"
    },
    "mac": {
      "category": "public.app-category.productivity",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "notarize": true,
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        },
        {
          "target": "zip",
          "arch": ["x64", "arm64"]
        }
      ]
    }
  }
}
```

### Vite Config (Version Injection)

```typescript
// In apps/desktop/renderer/vite.config.ts

import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // ... rest of config
});
```

### Dependencies to Add

```bash
# In apps/desktop (or electron/main)
bun add electron-updater
bun add -D @types/electron-updater  # if needed
```

---

## CI/CD Changes

### Release Workflow Updates

The `release.yml` workflow needs to:

1. Build ZIP files alongside DMG for macOS
2. Upload the `latest-mac.yml` manifest file that electron-builder generates

```yaml
# In .github/workflows/release.yml

# Update the build step to include ZIP
- name: Build macOS
  run: |
    bun run build:desktop
    # electron-builder will generate both DMG and ZIP
    # and create latest-mac.yml manifest
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

# Ensure latest-mac.yml is uploaded alongside DMG and ZIP
- name: Upload artifacts
  uses: softprops/action-gh-release@v1
  with:
    files: |
      apps/desktop/dist/*.dmg
      apps/desktop/dist/*.zip
      apps/desktop/dist/latest-mac.yml
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No internet connection | Check fails silently, retries on next interval |
| Download interrupted | Resumes on next check (electron-updater handles this) |
| User quits during download | Download restarts on next launch |
| Multiple windows open | Update applies to all windows on restart |
| App launched offline then goes online | Next hourly check will find update |
| Update check during update download | Ignored (already downloading) |
| GitHub rate limiting | Fails silently, retries on next interval |
| Corrupt download | electron-updater validates checksum, re-downloads if invalid |
| Very large update | Progress not shown (silent download); may take time |
| User never restarts | Badge persists; update installs on eventual restart |
| Downgrade attempt | electron-updater prevents downgrades by default |

---

## Testing Plan

### Unit Tests

**useUpdateStatus hook** (`useUpdateStatus.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Initial state | Status is 'idle' |
| Checking event | Status changes to 'checking' |
| Available event | Status changes to 'downloading', version set |
| Downloaded event | Status changes to 'ready', hasUpdate is true |
| Error event | Status changes to 'error', error message set |
| Dismiss | dismissed state becomes true |
| New update resets dismissed | dismissed becomes false on new downloaded event |

**VersionIndicator component** (`VersionIndicator.test.tsx`)

| Test Case | Description |
|-----------|-------------|
| Displays version | Shows current app version |
| No badge when no update | Badge not visible when status is 'idle' |
| Badge appears when ready | Badge visible when status is 'ready' |
| Click opens popover | Clicking when update ready opens popover |
| Click disabled when no update | Button disabled when no update |

**UpdatePopover component** (`UpdatePopover.test.tsx`)

| Test Case | Description |
|-----------|-------------|
| Displays version | Shows new version number |
| Restart button calls install | Clicking button calls onInstall |
| Click outside closes | Clicking outside calls onClose |
| Escape closes | Pressing Escape calls onClose |

### Integration Tests

**Flow 1: Update available and installed**

1. Mock electron-updater to emit update-available
2. Verify badge appears on version indicator
3. Click version indicator
4. Verify popover appears with correct version
5. Click "Restart Now"
6. Verify quitAndInstall was called

**Flow 2: Update dismissed and re-opened**

1. Mock update-downloaded event
2. Click version indicator to open popover
3. Click outside to dismiss
4. Verify popover closes
5. Verify badge still visible
6. Click version indicator again
7. Verify popover re-opens

**Flow 3: No update available**

1. App starts
2. Mock update-not-available event
3. Verify no badge visible
4. Verify clicking version does nothing

### Manual Testing Checklist

| Test | Expected |
|------|----------|
| Fresh install checks for updates | Update check runs ~10s after launch |
| Hourly check fires | Update check runs 1 hour after last check |
| Badge pulse animation | Badge has subtle pulsing effect |
| Popover positioning | Popover appears above version, aligned right |
| Dark mode styling | All components styled correctly in dark mode |
| Notarization works | App opens without Gatekeeper warnings |
| Update installs correctly | After restart, new version is running |

---

## Implementation Order

### Phase 1: Dependencies & Configuration
1. **Add electron-updater** - Install dependency
2. **Update electron-builder config** - Add publish config, ZIP target
3. **Update vite config** - Inject version at build time

### Phase 2: Main Process
4. **Create auto-updater module** - Setup function with event handlers
5. **Add IPC handlers** - check and install handlers
6. **Integrate in main.ts** - Call setup on app ready (production only)

### Phase 3: Preload
7. **Extend preload API** - Add update namespace with methods
8. **Update type declarations** - Add UpdateAPI types

### Phase 4: Renderer Components
9. **Create useUpdateStatus hook** - State management for update status
10. **Create VersionIndicator component** - Version display with badge
11. **Create UpdatePopover component** - Popover with install button
12. **Integrate in Sidebar** - Add VersionIndicator to footer

### Phase 5: CI/CD
13. **Update release workflow** - Build ZIP, upload manifests

### Phase 6: Testing
14. **Unit tests** - Hook and component tests
15. **Integration tests** - Full flow tests
16. **Manual testing** - Real update cycle verification

---

## Files to Create

| File | Purpose |
|------|---------|
| `electron/main/src/auto-updater.ts` | Auto-updater setup and configuration |
| `renderer/src/hooks/useUpdateStatus.ts` | Update status state management |
| `renderer/src/components/Sidebar/VersionIndicator.tsx` | Version display component |
| `renderer/src/components/Sidebar/VersionIndicator.css.ts` | Version indicator styles |
| `renderer/src/components/Sidebar/UpdatePopover.tsx` | Update popover component |
| `renderer/src/components/Sidebar/UpdatePopover.css.ts` | Popover styles |

## Files to Modify

| File | Changes |
|------|---------|
| `apps/desktop/package.json` | Add electron-updater dep, update build config |
| `apps/desktop/electron/main/src/main.ts` | Import and call setupAutoUpdater |
| `apps/desktop/electron/preload/src/preload.ts` | Add update API |
| `apps/desktop/renderer/src/types/scribe.d.ts` | Add UpdateAPI types |
| `apps/desktop/renderer/src/components/Sidebar/Sidebar.tsx` | Add VersionIndicator |
| `apps/desktop/renderer/src/components/Sidebar/Sidebar.css.ts` | Add footerRight style |
| `apps/desktop/renderer/vite.config.ts` | Add version define |
| `.github/workflows/release.yml` | Update to build ZIP and upload manifests |

---

## Future Considerations

- **Release notes display** - Show changelog in popover or separate dialog
- **Download progress** - Show progress bar for large updates
- **Multiple channels** - Beta channel for early adopters
- **Windows/Linux support** - Extend to other platforms
- **Staged rollout** - Percentage-based rollout for risk mitigation
- **Rollback** - Allow reverting to previous version
- **Update scheduling** - "Remind me later" or "Update tonight"
- **Bandwidth consideration** - Pause downloads on metered connections
- **Differential updates** - Smaller delta updates for faster downloads
