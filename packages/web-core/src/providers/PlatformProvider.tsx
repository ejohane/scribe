import React, { createContext, useContext } from 'react';

/**
 * Information about an available update.
 */
export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

/**
 * Platform capabilities that may or may not be available depending on the runtime.
 * Web apps will have minimal or no capabilities, while Electron apps have full access.
 */
export interface PlatformCapabilities {
  /**
   * Window management (Electron only)
   */
  window?: {
    openNewWindow: () => void;
    openNoteInWindow: (noteId: string) => void;
    close: () => void;
  };

  /**
   * Native dialogs (Electron only)
   */
  dialog?: {
    selectFolder: () => Promise<string | null>;
    saveFile: (content: string, filename: string) => Promise<boolean>;
  };

  /**
   * Shell operations (Electron only)
   */
  shell?: {
    openExternal: (url: string) => void;
  };

  /**
   * Auto-update functionality (Electron only)
   */
  update?: {
    check: () => void;
    install: () => void;
    onAvailable: (cb: (info: UpdateInfo) => void) => () => void;
  };
}

/**
 * Supported platform types.
 */
export type Platform = 'web' | 'electron';

interface PlatformContextValue {
  platform: Platform;
  capabilities: PlatformCapabilities;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

interface PlatformProviderProps {
  children: React.ReactNode;
  platform: Platform;
  capabilities: PlatformCapabilities;
}

/**
 * PlatformProvider provides platform detection and capability access.
 * This allows components to gracefully degrade features when running
 * in environments without native capabilities (e.g., web vs Electron).
 *
 * @param children - React children to render
 * @param platform - The current platform ('web' or 'electron')
 * @param capabilities - Platform-specific capabilities
 *
 * @example
 * ```tsx
 * // Web app usage
 * function WebApp() {
 *   return (
 *     <PlatformProvider platform="web" capabilities={{}}>
 *       <App />
 *     </PlatformProvider>
 *   );
 * }
 *
 * // Electron app usage
 * function ElectronApp() {
 *   const capabilities = {
 *     window: window.electron.window,
 *     dialog: window.electron.dialog,
 *     shell: window.electron.shell,
 *   };
 *
 *   return (
 *     <PlatformProvider platform="electron" capabilities={capabilities}>
 *       <App />
 *     </PlatformProvider>
 *   );
 * }
 * ```
 */
export function PlatformProvider({ children, platform, capabilities }: PlatformProviderProps) {
  return (
    <PlatformContext.Provider value={{ platform, capabilities }}>
      {children}
    </PlatformContext.Provider>
  );
}

/**
 * Hook to access platform information and capabilities.
 *
 * @throws Error if used outside of PlatformProvider
 * @returns The platform context value
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { platform, capabilities } = usePlatform();
 *
 *   if (capabilities.dialog) {
 *     // Can use native dialogs
 *   }
 * }
 * ```
 */
export function usePlatform(): PlatformContextValue {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider');
  }
  return context;
}

/**
 * Convenience hook to check if running in Electron.
 *
 * @returns true if running in Electron, false otherwise
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isElectron = useIsElectron();
 *
 *   return isElectron ? <ElectronFeature /> : <WebFallback />;
 * }
 * ```
 */
export function useIsElectron(): boolean {
  return usePlatform().platform === 'electron';
}

/**
 * Convenience hook to access window capabilities.
 *
 * @returns Window capabilities or undefined if not available
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const windowCaps = useWindowCapabilities();
 *
 *   const handleOpenInNewWindow = () => {
 *     windowCaps?.openNoteInWindow(noteId);
 *   };
 * }
 * ```
 */
export function useWindowCapabilities(): PlatformCapabilities['window'] {
  return usePlatform().capabilities.window;
}

/**
 * Convenience hook to access dialog capabilities.
 *
 * @returns Dialog capabilities or undefined if not available
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const dialogCaps = useDialogCapabilities();
 *
 *   const handleSelectFolder = async () => {
 *     const folder = await dialogCaps?.selectFolder();
 *   };
 * }
 * ```
 */
export function useDialogCapabilities(): PlatformCapabilities['dialog'] {
  return usePlatform().capabilities.dialog;
}

/**
 * Convenience hook to access shell capabilities.
 *
 * @returns Shell capabilities or undefined if not available
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const shellCaps = useShellCapabilities();
 *
 *   const handleOpenLink = (url: string) => {
 *     shellCaps?.openExternal(url);
 *   };
 * }
 * ```
 */
export function useShellCapabilities(): PlatformCapabilities['shell'] {
  return usePlatform().capabilities.shell;
}

/**
 * Convenience hook to access update capabilities.
 *
 * @returns Update capabilities or undefined if not available
 *
 * @example
 * ```tsx
 * function UpdateChecker() {
 *   const updateCaps = useUpdateCapabilities();
 *
 *   useEffect(() => {
 *     return updateCaps?.onAvailable((info) => {
 *       console.log('Update available:', info.version);
 *     });
 *   }, [updateCaps]);
 * }
 * ```
 */
export function useUpdateCapabilities(): PlatformCapabilities['update'] {
  return usePlatform().capabilities.update;
}
