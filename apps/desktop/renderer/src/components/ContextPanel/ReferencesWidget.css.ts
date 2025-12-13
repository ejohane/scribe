/**
 * ReferencesWidget component styles
 *
 * Styles for the references widget that displays wiki-links and URLs
 * extracted from note content.
 */

import { style } from '@vanilla-extract/css';
import { vars, emptyStateInline } from '@scribe/design-system';

/**
 * Card container matching other context panel widgets
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

/**
 * Icon color for references (tertiary/links semantic)
 */
export const cardIconTertiary = style({
  color: vars.color.tertiary,
});

export const cardTitle = style({
  fontSize: vars.typography.size.xs,
});

/**
 * List container for references
 */
export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

/**
 * Individual reference item (clickable button)
 */
export const referenceItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: vars.spacing['2'],
  borderRadius: vars.radius.sm,
  background: 'none',
  border: 'none',
  color: vars.color.foreground,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  fontSize: vars.typography.size.sm,
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

/**
 * External link icon for URLs
 */
export const urlIcon = style({
  color: vars.color.foregroundMuted,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
});

/**
 * Reference display text with ellipsis for overflow
 */
export const referenceText = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

/**
 * Empty state message - re-exported from design system
 */
export const emptyState = emptyStateInline;
