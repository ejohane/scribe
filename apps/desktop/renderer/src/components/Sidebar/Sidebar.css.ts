import { style, createVar } from '@vanilla-extract/css';
import {
  vars,
  emptyStateCentered,
  panelBase,
  panelBorderRight,
  panelOpenLeft,
  panelClosedLeft,
  panelInnerBase,
} from '@scribe/design-system';

/**
 * Sidebar component styles
 * Uses design system tokens and CollapsiblePanel primitive for consistent theming
 */

/** CSS custom property for dynamic sidebar width */
export const sidebarWidth = createVar();

/**
 * Main sidebar container
 * Uses CollapsiblePanel primitive for collapse/expand animation
 * Width is controlled via CSS custom property (--sidebar-width) set at runtime
 */
export const sidebar = style([panelBase, panelBorderRight, { vars: { [sidebarWidth]: '280px' } }]);

export const sidebarOpen = style([panelOpenLeft, { width: sidebarWidth }]);

export const sidebarClosed = panelClosedLeft;

/**
 * Inner container maintains width during collapse animation
 * Uses CollapsiblePanel primitive for consistent structure
 */
export const sidebarInner = style([panelInnerBase, { width: sidebarWidth }]);

/**
 * Header section with branding
 */
export const header = style({
  padding: vars.spacing['6'],
  paddingTop: vars.spacing['4'],
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
 * Header toolbar container for navigation buttons - at top, same level as TopToolbar
 * paddingTop of 48px matches the TopToolbar position (below titlebar drag region)
 */
export const headerToolbar = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  padding: `0 ${vars.spacing['4']}`,
  paddingTop: '48px',
  height: '88px', // 48px padding + 40px toolbar height to match TopToolbar
  boxSizing: 'border-box',
});

/**
 * Toolbar button - flat design, no animations
 */
export const toolbarButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  borderRadius: vars.radius.md,
  border: 'none',
  background: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',

  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },

  ':focus': {
    outline: 'none',
  },

  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },

  ':disabled': {
    opacity: 0.3,
    cursor: 'not-allowed',
  },

  selectors: {
    '&:disabled:hover': {
      backgroundColor: 'transparent',
      color: vars.color.foregroundMuted,
    },
  },
});

/**
 * Vertical divider between button groups
 */
export const toolbarDivider = style({
  width: '1px',
  height: '20px',
  backgroundColor: vars.color.border,
  margin: `0 ${vars.spacing['1']}`,
  flexShrink: 0,
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
 * Clear History button styles
 */
export const clearHistoryButton = style({
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
    color: vars.color.danger,
    backgroundColor: vars.color.background,
    borderColor: vars.color.border,
    boxShadow: vars.shadow.md,
  },
});

export const clearHistoryIconCircle = style({
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surface,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,

  selectors: {
    [`${clearHistoryButton}:hover &`]: {
      backgroundColor: vars.color.danger,
      color: vars.color.accentForeground,
    },
  },
});

/**
 * Empty state styles - extends design system with larger padding
 */
export const emptyState = style([emptyStateCentered, { padding: vars.spacing['6'] }]);

export const emptyStateHint = style({
  marginTop: vars.spacing['2'],
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  opacity: 0.7,
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

export const footerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
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
