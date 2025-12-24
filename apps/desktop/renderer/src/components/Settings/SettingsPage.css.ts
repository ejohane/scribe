import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Settings Page styles
 * Full-screen modal with VS Code-style sidebar navigation
 */

/** Full-screen container taking up entire viewport */
export const container = style({
  position: 'fixed',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.background,
  zIndex: vars.zIndex.modal,
});

/** Header with title and close button */
export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${vars.spacing['4']} ${vars.spacing['6']}`,
  borderBottom: `1px solid ${vars.color.border}`,
  // Account for macOS traffic lights
  paddingTop: '48px',
});

/** Title text in header */
export const headerTitle = style({
  fontSize: vars.typography.size['2xl'],
  fontWeight: vars.typography.weight.bold,
  color: vars.color.foreground,
});

/** Close button */
export const closeButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  border: 'none',
  borderRadius: vars.radius.md,
  backgroundColor: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  transition: `all ${vars.animation.duration.fast}`,

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
});

/** Main content area with sidebar and main section */
export const content = style({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

/** Settings sidebar navigation */
export const sidebar = style({
  width: '220px',
  flexShrink: 0,
  backgroundColor: vars.color.backgroundAlt,
  borderRight: `1px solid ${vars.color.border}`,
  padding: vars.spacing['4'],
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

/** Navigation item in sidebar */
export const navItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: `${vars.spacing['3']} ${vars.spacing['4']}`,
  borderRadius: vars.radius.md,
  border: 'none',
  backgroundColor: 'transparent',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: `all ${vars.animation.duration.fast}`,

  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },

  ':focus': {
    outline: 'none',
  },

  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '-2px',
  },
});

/** Active navigation item */
export const navItemActive = style({
  backgroundColor: vars.color.surface,
  color: vars.color.foreground,
});

/** Main content area for settings sections */
export const main = style({
  flex: 1,
  overflow: 'auto',
  padding: vars.spacing['6'],
});

/** Section within the main content */
export const section = style({
  maxWidth: '600px',
});

/** Section heading */
export const sectionHeading = style({
  fontSize: vars.typography.size.xl,
  fontWeight: vars.typography.weight.bold,
  color: vars.color.foreground,
  marginBottom: vars.spacing['4'],
});

/** Section description / placeholder text */
export const sectionDescription = style({
  fontSize: vars.typography.size.md,
  color: vars.color.foregroundMuted,
  lineHeight: vars.typography.lineHeight.relaxed,
});
