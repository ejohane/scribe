import { style, createVar } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * ContextPanel component styles
 * Right sidebar showing contextual information about the current note
 */

/** CSS custom property for dynamic panel width */
export const panelWidth = createVar();

/**
 * Main panel container
 * Handles the collapse/expand animation
 * Width is controlled via CSS custom property (--panel-width) set at runtime
 */
export const contextPanel = style({
  vars: {
    [panelWidth]: '280px', // Default width
  },
  height: '100%',
  backgroundColor: vars.color.backgroundAlt,
  flexShrink: 0,
  borderLeft: `1px solid ${vars.color.border}`,
  transition: `all ${vars.animation.duration.slower} ${vars.animation.easing.smooth}`,
  overflow: 'visible',
  position: 'relative', // For resize handle positioning
});

export const contextPanelOpen = style({
  width: panelWidth,
  opacity: 1,
  transform: 'translateX(0)',
});

export const contextPanelClosed = style({
  width: 0,
  opacity: 0,
  transform: 'translateX(40px)',
});

/**
 * Inner container maintains width during collapse animation
 * Width is set via CSS custom property to support resizing
 */
export const panelInner = style({
  width: panelWidth,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  padding: vars.spacing['4'],
  paddingTop: vars.spacing['8'],
  overflowX: 'hidden', // Hide horizontal content during collapse animation
  overflowY: 'auto', // Allow vertical scrolling
});

/**
 * Section label (CONTEXT, CALENDAR, etc.)
 */
export const sectionLabel = style({
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: vars.spacing['3'],
  marginTop: vars.spacing['6'],
  opacity: 0.4,

  selectors: {
    '&:first-child': {
      marginTop: 0,
    },
  },
});

/**
 * Card container for each widget
 */
export const card = style({
  backgroundColor: vars.color.background,
  borderRadius: vars.radius.xl,
  padding: vars.spacing['4'],
  marginBottom: vars.spacing['3'],
  boxShadow: vars.shadow.sm,
  border: `1px solid ${vars.color.border}`,
  transition: `background-color ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

/**
 * Card header with icon and title
 */
export const cardHeader = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  marginBottom: vars.spacing['3'],
  color: vars.color.foreground,
  fontWeight: vars.typography.weight.medium,
});

export const cardIcon = style({
  width: '14px',
  height: '14px',
  flexShrink: 0,
});

export const cardTitle = style({
  fontSize: vars.typography.size.xs,
});

/**
 * Backlink item styles
 */
export const backlinkItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: vars.spacing['2'],
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const backlinkIcon = style({
  width: '24px',
  height: '24px',
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surface,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});

export const backlinkContent = style({
  flex: 1,
  minWidth: 0,
});

export const backlinkTitle = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const backlinkMeta = style({
  fontSize: '10px',
  color: vars.color.foregroundMuted,
  marginTop: vars.spacing['1'],
});

/**
 * Task item styles
 */
export const taskItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: vars.spacing['2'],
  marginBottom: vars.spacing['2'],

  selectors: {
    '&:last-child': {
      marginBottom: 0,
    },
  },
});

export const taskCheckbox = style({
  marginTop: '2px',
  accentColor: vars.color.accent,
  borderRadius: vars.radius.sm,
});

export const taskText = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foreground,
  lineHeight: vars.typography.lineHeight.normal,
});

export const taskTextCompleted = style({
  color: vars.color.foregroundMuted,
  textDecoration: 'line-through',
});

/**
 * Calendar date pills
 */
export const datePills = style({
  display: 'flex',
  gap: vars.spacing['2'],
  overflowX: 'auto',
  paddingBottom: vars.spacing['2'],
});

export const datePill = style({
  flexShrink: 0,
  width: '40px',
  height: '48px',
  borderRadius: vars.radius.lg,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${vars.color.border}`,
  color: vars.color.foregroundMuted,
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  cursor: 'pointer',

  ':hover': {
    borderColor: vars.color.foreground,
    color: vars.color.foreground,
  },
});

export const datePillActive = style({
  backgroundColor: vars.color.foreground,
  color: vars.color.background,
  borderColor: vars.color.foreground,

  ':hover': {
    backgroundColor: vars.color.foreground,
    color: vars.color.background,
    borderColor: vars.color.foreground,
  },
});

export const datePillMonth = style({
  fontSize: '10px',
  fontWeight: vars.typography.weight.bold,
  textTransform: 'uppercase',
});

export const datePillDay = style({
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
});

/**
 * Calendar event item
 */
export const eventItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  marginTop: vars.spacing['3'],
  paddingTop: vars.spacing['3'],
  borderTop: `1px solid ${vars.color.border}`,
  fontSize: vars.typography.size.xs,
  color: vars.color.foreground,
});

export const eventIcon = style({
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});

/**
 * Empty state
 */
export const emptyState = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  fontStyle: 'italic',
  padding: vars.spacing['2'],
});

/**
 * Backlink list container
 */
export const backlinkList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});
