import { style } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

/**
 * DatePicker component styles.
 *
 * Uses design system tokens for consistent theming.
 * Z-index 100 for popover to work in command palette context.
 */

export const container = style({
  position: 'relative',
  display: 'inline-block',
});

export const trigger = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.foreground,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  transition: `border-color ${vars.animation.duration.fast}, box-shadow ${vars.animation.duration.fast}`,
  ':hover': {
    borderColor: vars.color.accent,
  },
  ':focus': {
    outline: 'none',
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px ${vars.color.background}, 0 0 0 4px ${vars.color.accent}`,
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const triggerText = style({
  flex: 1,
  textAlign: 'left',
});

export const triggerIcon = style({
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});

export const popover = style({
  // Position is set inline via style prop when using portal
  zIndex: 10000, // High z-index to appear above modals/overlays
  backgroundColor: vars.color.background,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  border: `1px solid ${vars.color.border}`,
  overflow: 'hidden',
});
