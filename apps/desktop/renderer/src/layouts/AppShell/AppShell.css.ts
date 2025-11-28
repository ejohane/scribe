import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * AppShell - Three-panel layout styles
 *
 * Layout: [Sidebar] [Main Content] [Context Panel]
 * - Sidebar and Context Panel are collapsible with smooth animations
 * - Main content area fills available space
 */

export const container = style({
  display: 'flex',
  height: '100vh',
  width: '100%',
  backgroundColor: vars.color.background,
  overflow: 'hidden',
});

export const sidebar = style({
  width: '320px',
  flexShrink: 0,
  transition: `all ${vars.animation.duration.slower} ${vars.animation.easing.smooth}`,
  backgroundColor: vars.color.backgroundAlt,
  borderRight: `1px solid ${vars.color.border}`,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

export const sidebarClosed = style({
  width: 0,
  opacity: 0,
  transform: 'translateX(-40px)',
  borderRight: 'none',
});

export const sidebarContent = style({
  flex: 1,
  overflow: 'auto',
  // Add padding top to account for titlebar drag region
  paddingTop: '40px',
});

export const main = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0, // Allow shrinking below content size
  overflow: 'hidden',
  position: 'relative',
});

export const mainContent = style({
  flex: 1,
  overflow: 'auto',
});

export const contextPanel = style({
  width: '320px',
  flexShrink: 0,
  transition: `all ${vars.animation.duration.slower} ${vars.animation.easing.smooth}`,
  backgroundColor: vars.color.backgroundAlt,
  borderLeft: `1px solid ${vars.color.border}`,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

export const contextPanelClosed = style({
  width: 0,
  opacity: 0,
  transform: 'translateX(40px)',
  borderLeft: 'none',
});

export const contextPanelContent = style({
  flex: 1,
  overflow: 'auto',
  // Add padding top to account for titlebar drag region
  paddingTop: '40px',
});
