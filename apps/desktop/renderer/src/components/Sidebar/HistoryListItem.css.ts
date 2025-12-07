import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * HistoryListItem component styles
 */

export const historyItem = style({
  position: 'relative',
  padding: vars.spacing['3'],
  borderRadius: vars.radius.lg,
  cursor: 'pointer',
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const historyItemActive = style({
  backgroundColor: vars.color.background,
  boxShadow: `inset 0 0 0 1px ${vars.color.accent}10, ${vars.shadow.sm}`,
});

export const historyItemInactive = style({
  color: vars.color.foregroundMuted,
});

/** Position indicator showing where in history this item is */
export const positionIndicator = style({
  width: '20px',
  height: '20px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surface,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '10px',
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});

export const positionIndicatorCurrent = style({
  backgroundColor: vars.color.accent,
  color: vars.color.accentForeground,
});

export const historyContent = style({
  flex: 1,
  overflow: 'hidden',
});

export const historyTitle = style({
  fontWeight: vars.typography.weight.medium,
  fontSize: vars.typography.size.sm,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: vars.color.foreground,
});

export const historyTitleInactive = style({
  color: vars.color.foreground,
});

export const historySubtitle = style({
  fontSize: '10px',
  color: vars.color.foregroundMuted,
  fontWeight: vars.typography.weight.medium,
  marginTop: vars.spacing['1'],
});
