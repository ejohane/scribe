/**
 * FilterBar component styles
 *
 * Styles for the task filter controls bar with dropdown selects.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Container for filter controls
 */
export const filterBar = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: vars.spacing['3'],
  paddingBottom: vars.spacing['4'],
  borderBottom: `1px solid ${vars.color.border}`,
});

/**
 * Individual filter group (label + select)
 */
export const filterGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
  minWidth: '140px',
});

/**
 * Filter label
 */
export const filterLabel = style({
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

/**
 * Select dropdown
 */
export const select = style({
  appearance: 'none',
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  paddingRight: vars.spacing['8'],
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
  cursor: 'pointer',
  transition: `all ${vars.animation.duration.normal} ${vars.animation.easing.default}`,

  // Custom dropdown arrow
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: `right ${vars.spacing['3']} center`,

  ':hover': {
    borderColor: vars.color.accent,
    backgroundColor: vars.color.background,
  },

  ':focus': {
    outline: 'none',
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px ${vars.color.accent}33`,
  },

  ':focus-visible': {
    outline: 'none',
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px ${vars.color.accent}33`,
  },
});
