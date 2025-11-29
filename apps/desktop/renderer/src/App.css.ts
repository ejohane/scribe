import { style, globalStyle } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * App-specific layout and component styles.
 * Uses design system tokens for consistency.
 *
 * @see features/design-system/spec.md
 */

// Titlebar drag region for macOS frameless window
export const titlebarDragRegion = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 40,
  // @ts-expect-error - WebKit-specific property for Electron window dragging
  WebkitAppRegion: 'drag',
  zIndex: 1,
  pointerEvents: 'none',
});

// Main app container - uses row layout for sidebar + content
export const app = style({
  position: 'relative',
  width: '100%',
  height: '100vh',
  display: 'flex',
  flexDirection: 'row',
});

// Main content area that expands to fill space next to sidebar
export const mainContent = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0, // Prevent flex blowout
  position: 'relative',
});

// Backlinks overlay styles
export const backlinksOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: vars.zIndex.palette,
});

export const backlinksPanel = style({
  backgroundColor: vars.color.background,
  borderRadius: vars.radius.md,
  width: '90%',
  maxWidth: '600px',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: vars.shadow.lg,
});

export const backlinksHeader = style({
  padding: `${vars.spacing[4]} ${vars.spacing[4]}`,
  borderBottom: `1px solid ${vars.color.border}`,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

// Use globalStyle for nested elements within backlinksHeader
globalStyle(`${backlinksHeader} h3`, {
  margin: 0,
  fontSize: vars.typography.size.lg,
  fontWeight: vars.typography.weight.bold,
  color: vars.color.foreground,
});

globalStyle(`${backlinksHeader} button`, {
  padding: `${vars.spacing[1]} ${vars.spacing[3]}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.background,
  color: vars.color.foreground,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
});

globalStyle(`${backlinksHeader} button:hover`, {
  backgroundColor: vars.color.surface,
});

export const backlinksList = style({
  overflowY: 'auto',
  flex: 1,
  padding: vars.spacing[2],
});

export const backlinksEmpty = style({
  padding: `${vars.spacing[8]} ${vars.spacing[4]}`,
  textAlign: 'center',
  color: vars.color.foregroundMuted,
});

export const backlinkItem = style({
  padding: `${vars.spacing[3]} ${vars.spacing[4]}`,
  borderRadius: vars.radius.md,
  marginBottom: vars.spacing[1],
  cursor: 'pointer',
  transition: 'background 0.1s',
  selectors: {
    '&:hover': {
      backgroundColor: vars.color.surface,
    },
  },
});

export const backlinkTitle = style({
  fontWeight: vars.typography.weight.medium,
  marginBottom: vars.spacing[1],
  color: vars.color.foreground,
});

export const backlinkTags = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.spacing[1],
  marginTop: vars.spacing[1],
});

export const backlinkTag = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  backgroundColor: vars.color.surface,
  padding: `${vars.spacing[0]} ${vars.spacing[2]}`,
  borderRadius: vars.radius.sm,
});
