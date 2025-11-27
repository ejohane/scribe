/**
 * @scribe/design-system
 *
 * Design system package for Scribe.
 * Provides tokens, themes, and primitive components using vanilla-extract.
 *
 * @see features/design-system/spec.md for full specification
 */

export * from './tokens';
export * from './themes';
export { ThemeProvider, useTheme } from './ThemeProvider';
export type { ThemeStorage } from './ThemeProvider';
export * from './primitives';
