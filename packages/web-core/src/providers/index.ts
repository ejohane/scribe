export { ScribeProvider, useScribe, useTrpc } from './ScribeProvider';
export {
  PlatformProvider,
  usePlatform,
  useIsElectron,
  useWindowCapabilities,
  useDialogCapabilities,
  useShellCapabilities,
  useUpdateCapabilities,
} from './PlatformProvider';
export type { PlatformCapabilities, Platform, UpdateInfo } from './PlatformProvider';
export { CollabProvider, useCollab } from './CollabProvider';
export type { CollabContextValue, CollabProviderProps } from './CollabProvider';

// Command Palette Provider
export { CommandPaletteProvider, useCommandPalette } from '../components/CommandPalette';
export type { CommandPaletteProviderProps } from '../components/CommandPalette';
