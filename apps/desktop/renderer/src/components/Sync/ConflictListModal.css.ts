import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Modal container
 */
export const container = style({
  width: '600px',
  maxWidth: '90vw',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.surface,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  overflow: 'hidden',
});

/**
 * Modal header with icon and title
 */
export const header = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: vars.spacing['3'],
  padding: vars.spacing['4'],
  borderBottom: `1px solid ${vars.color.border}`,
});

/**
 * Warning icon in header
 */
export const warningIcon = style({
  color: vars.color.warning,
  flexShrink: 0,
});

/**
 * Header text container
 */
export const headerText = style({
  flex: 1,
  minWidth: 0,
});

/**
 * Scrollable list of conflicts
 */
export const list = style({
  flex: 1,
  overflowY: 'auto',
  padding: vars.spacing['2'],
});

/**
 * Empty state when no conflicts
 */
export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: vars.spacing['8'],
  textAlign: 'center',
});

/**
 * Individual conflict item
 */
export const item = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: vars.spacing['3'],
  borderRadius: vars.radius.md,
  gap: vars.spacing['3'],

  ':hover': {
    backgroundColor: vars.color.backgroundAlt,
  },
});

/**
 * Conflict item content (title and metadata)
 */
export const itemContent = style({
  flex: 1,
  minWidth: 0,
});

/**
 * Note title in conflict item
 */
export const itemTitle = style({
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

/**
 * Timestamp metadata
 */
export const itemMeta = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  marginTop: vars.spacing['1'],
});

/**
 * Action buttons container
 */
export const itemActions = style({
  display: 'flex',
  gap: vars.spacing['2'],
  flexShrink: 0,
});

/**
 * Conflict type badge
 */
export const conflictTypeBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  borderRadius: vars.radius.sm,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  backgroundColor: vars.color.backgroundAlt,
  color: vars.color.foregroundMuted,
});

/**
 * Modal footer
 */
export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: vars.spacing['4'],
  borderTop: `1px solid ${vars.color.border}`,
});

/**
 * Footer hint text
 */
export const footerHint = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
});
