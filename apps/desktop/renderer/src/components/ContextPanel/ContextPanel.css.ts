import { style, createVar } from '@vanilla-extract/css';
import {
  vars,
  emptyStateInline,
  panelBase,
  panelBorderLeft,
  panelOpenRight,
  panelClosedRight,
  panelInnerBase,
} from '@scribe/design-system';
import { widgetCard, widgetCardHeader, widgetCardIcon, widgetCardTitle } from './shared.css';

/**
 * ContextPanel component styles
 * Right sidebar showing contextual information about the current note
 * Uses CollapsiblePanel primitive for consistent theming
 */

/** CSS custom property for dynamic panel width */
export const panelWidth = createVar();

/**
 * Main panel container
 * Uses CollapsiblePanel primitive for collapse/expand animation
 * Width is controlled via CSS custom property (--panel-width) set at runtime
 */
export const contextPanel = style([
  panelBase,
  panelBorderLeft,
  { vars: { [panelWidth]: '280px' } },
]);

export const contextPanelOpen = style([panelOpenRight, { width: panelWidth }]);

export const contextPanelClosed = panelClosedRight;

/**
 * Inner container maintains width during collapse animation
 * Uses CollapsiblePanel primitive with custom padding/overflow for ContextPanel
 */
export const panelInner = style([
  panelInnerBase,
  {
    width: panelWidth,
    padding: vars.spacing['4'],
    paddingTop: 0,
    overflowX: 'hidden', // Hide horizontal content during collapse animation
    overflowY: 'auto', // Allow vertical scrolling
  },
]);

/**
 * Header toolbar container - matches Sidebar.headerToolbar positioning
 * paddingTop of 48px matches the TopToolbar position (below titlebar drag region)
 */
export const headerToolbar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.spacing['1'],
  padding: `0 ${vars.spacing['4']}`,
  paddingTop: '48px',
  height: '88px', // 48px padding + 40px toolbar height to match Sidebar/TopToolbar
  boxSizing: 'border-box',
});

/**
 * Section header with label and optional toolbar button
 */
export const sectionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: vars.spacing['3'],
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
  marginTop: vars.spacing['6'],
  opacity: 0.4,

  selectors: {
    '&:first-child': {
      marginTop: 0,
    },
    [`${sectionHeader} &`]: {
      marginBottom: 0,
      marginTop: 0,
    },
    [`${headerToolbar} &`]: {
      marginBottom: 0,
      marginTop: 0,
    },
  },
});

/**
 * Header buttons container - groups share and close buttons
 */
export const headerButtons = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
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
});

/**
 * Card container for each widget - re-exported from shared
 */
export const card = widgetCard;

/**
 * Card header with icon and title - re-exported from shared
 */
export const cardHeader = widgetCardHeader;

/**
 * Clickable card header (for navigating to full-screen views)
 */
export const cardHeaderClickable = style({
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  padding: vars.spacing['1'],
  margin: `calc(-1 * ${vars.spacing['1']})`,
  marginBottom: vars.spacing['2'],
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },

  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
});

/**
 * Card icon - re-exported from shared
 */
export const cardIcon = widgetCardIcon;

/**
 * Icon color variants for semantic coloring
 */
export const cardIconSuccess = style({
  color: vars.color.success,
});

/**
 * Card title - re-exported from shared
 */
export const cardTitle = widgetCardTitle;

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
 * Empty state - re-exported from design system
 */
export const emptyState = emptyStateInline;

/**
 * Backlink list container
 */
export const backlinkList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

/**
 * Badge container for date-based mentions
 */
export const backlinkBadges = style({
  display: 'flex',
  gap: vars.spacing['1'],
  marginTop: vars.spacing['1'],
});

/**
 * Badge for indicating mention type (Created, Modified)
 */
export const mentionBadge = style({
  fontSize: '10px',
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  backgroundColor: vars.color.surface,
  padding: `2px 6px`,
  borderRadius: vars.radius.sm,
  textTransform: 'uppercase',
  letterSpacing: '0.025em',
});

/**
 * Expand/collapse button for linked mentions
 */
export const expandButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.spacing['1'],
  width: '100%',
  padding: vars.spacing['2'],
  marginTop: vars.spacing['1'],
  border: 'none',
  background: 'transparent',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },
});

/**
 * Scrollable task list container for expanded state
 * Max height allows for ~10 task items with scroll
 */
export const taskListScrollable = style({
  maxHeight: '320px',
  overflowY: 'auto',
  overflowX: 'hidden',
  marginRight: `calc(-1 * ${vars.spacing['2']})`,
  paddingRight: vars.spacing['2'],

  // Custom scrollbar styling
  '::-webkit-scrollbar': {
    width: '4px',
  },
  '::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '::-webkit-scrollbar-thumb': {
    backgroundColor: vars.color.border,
    borderRadius: vars.radius.full,
  },
  selectors: {
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: vars.color.foregroundMuted,
    },
  },
});
