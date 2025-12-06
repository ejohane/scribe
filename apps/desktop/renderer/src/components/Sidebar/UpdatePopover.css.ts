import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const popover = style({
  position: 'absolute',
  bottom: '100%',
  right: 0,
  marginBottom: vars.spacing['2'],
  padding: vars.spacing['4'],
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.lg,
  width: '220px',
  zIndex: vars.zIndex.popover,
});

export const header = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.bold,
  color: vars.color.foreground,
  marginBottom: vars.spacing['2'],
});

export const message = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  lineHeight: vars.typography.lineHeight.relaxed,
  margin: 0,
  marginBottom: vars.spacing['4'],
});

export const button = style({
  width: '100%',
});
