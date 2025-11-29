import { style, createVar } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Sidebar component styles
 * Uses design system tokens for consistent theming
 */

/** CSS custom property for dynamic sidebar width */
export const sidebarWidth = createVar();

/**
 * Main sidebar container
 * Handles the collapse/expand animation
 * Width is controlled via CSS custom property (--sidebar-width) set at runtime
 */
export const sidebar = style({
  vars: {
    [sidebarWidth]: '280px', // Default width
  },
  height: '100%',
  backgroundColor: vars.color.backgroundAlt,
  flexShrink: 0,
  borderRight: `1px solid ${vars.color.border}`,
  transition: `all ${vars.animation.duration.slower} ${vars.animation.easing.smooth}`,
  overflow: 'hidden',
  position: 'relative', // For resize handle positioning
});

export const sidebarOpen = style({
  width: sidebarWidth,
  opacity: 1,
  transform: 'translateX(0)',
});

export const sidebarClosed = style({
  width: 0,
  opacity: 0,
  transform: 'translateX(-40px)',
});

/**
 * Inner container maintains width during collapse animation
 * Width is set via CSS custom property to support resizing
 */
export const sidebarInner = style({
  width: sidebarWidth,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

/**
 * Header section with branding
 * paddingTop accounts for macOS titlebar drag region (traffic lights are ~28px tall)
 */
export const header = style({
  padding: vars.spacing['6'],
  paddingTop: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const branding = style({});

export const brandTitle = style({
  fontSize: vars.typography.size.xl,
  fontWeight: vars.typography.weight.bold,
  fontFamily: vars.typography.fontFamily.serif,
  letterSpacing: '-0.02em',
  color: vars.color.foreground,
});

export const brandLabel = style({
  fontSize: '10px',
  color: vars.color.foregroundMuted,
  marginTop: vars.spacing['1'],
  fontWeight: vars.typography.weight.medium,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
});

/**
 * Scrollable note list container
 */
export const noteListContainer = style({
  flex: 1,
  overflowY: 'auto',
  padding: vars.spacing['4'],
  paddingBottom: vars.spacing['4'],
});

/**
 * New Note button styles
 */
export const newNoteButton = style({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: vars.spacing['3'],
  color: vars.color.foregroundMuted,
  backgroundColor: 'transparent',
  border: `1px solid transparent`,
  borderRadius: vars.radius.xl,
  cursor: 'pointer',
  fontWeight: vars.typography.weight.medium,
  fontSize: vars.typography.size.sm,
  marginBottom: vars.spacing['6'],
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
  boxShadow: vars.shadow.sm,

  ':hover': {
    color: vars.color.foreground,
    backgroundColor: vars.color.background,
    borderColor: vars.color.border,
    boxShadow: vars.shadow.md,
  },
});

export const newNoteIconCircle = style({
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surface,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,

  selectors: {
    [`${newNoteButton}:hover &`]: {
      backgroundColor: vars.color.accent,
      color: vars.color.accentForeground,
    },
  },
});

/**
 * Note list - vertical stack of note items
 */
export const noteList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

/**
 * Footer section with user info and theme toggle
 */
export const footer = style({
  padding: vars.spacing['6'],
  borderTop: `1px solid ${vars.color.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const userInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  opacity: 0.6,
  transition: `opacity ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
  cursor: 'default',

  ':hover': {
    opacity: 1,
  },
});

export const userAvatar = style({
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.full,
  background: `linear-gradient(135deg, ${vars.color.surface} 0%, ${vars.color.border} 100%)`,
});

export const userName = style({
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
});

export const themeToggle = style({
  padding: vars.spacing['2'],
  borderRadius: vars.radius.full,
  color: vars.color.foregroundMuted,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',

  ':hover': {
    color: vars.color.foreground,
    backgroundColor: vars.color.surface,
  },
});
