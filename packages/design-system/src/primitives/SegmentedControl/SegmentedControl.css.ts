import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

/**
 * Container for the segmented control group
 */
export const container = style({
  display: 'inline-flex',
  alignItems: 'center',
  backgroundColor: vars.color.backgroundAlt,
  borderRadius: vars.radius.md,
  padding: vars.spacing['1'],
  gap: vars.spacing['1'],
});

/**
 * Full-width variant of the container
 */
export const fullWidth = style({
  display: 'flex',
  width: '100%',
});

/**
 * Base styles for each segment button
 */
export const segment = style({
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  cursor: 'pointer',
  fontFamily: vars.typography.fontFamily.ui,
  fontWeight: vars.typography.weight.medium,
  borderRadius: vars.radius.sm,
  backgroundColor: 'transparent',
  color: vars.color.foregroundMuted,
  transition: `background-color ${vars.animation.duration.fast}, color ${vars.animation.duration.fast}, box-shadow ${vars.animation.duration.fast}`,
  ':focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${vars.color.background}, 0 0 0 4px ${vars.color.accent}`,
    zIndex: 1,
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  selectors: {
    '&:hover:not(:disabled):not([aria-checked="true"])': {
      color: vars.color.foreground,
    },
  },
});

/**
 * Active segment styles
 */
export const segmentActive = style({
  backgroundColor: vars.color.surface,
  color: vars.color.foreground,
  boxShadow: vars.shadow.sm,
});

/**
 * Size variants for segments
 */
export const sizes = styleVariants({
  sm: {
    fontSize: vars.typography.size.sm,
    padding: `${vars.spacing['1']} ${vars.spacing['3']}`,
    minHeight: vars.component.button.heightSm,
  },
  md: {
    fontSize: vars.typography.size.md,
    padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
    minHeight: vars.component.button.heightMd,
  },
  lg: {
    fontSize: vars.typography.size.md,
    padding: `${vars.spacing['3']} ${vars.spacing['6']}`,
    minHeight: '44px',
  },
});

/**
 * Disabled state for entire control
 */
export const disabled = style({
  opacity: 0.5,
  pointerEvents: 'none',
});
