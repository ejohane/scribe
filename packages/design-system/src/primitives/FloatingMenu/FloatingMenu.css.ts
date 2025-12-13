/**
 * FloatingMenu Styles
 *
 * Vanilla-extract styles for floating menu primitives.
 * Used by autocomplete dropdowns, command palettes, and context menus.
 * Provides consistent styling across all floating UI elements.
 */

import { style, keyframes, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';
import { slideDown } from '../../tokens';
import { emptyStateCentered } from '../EmptyState';

/**
 * Spinner animation for loading states
 */
export const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

/**
 * Main floating menu container
 * Position is controlled via inline styles (top, left)
 */
export const container = style({
  position: 'fixed',
  zIndex: vars.zIndex.popover,
  minWidth: '200px',
  maxWidth: '320px',
  maxHeight: '300px',
  overflow: 'auto',

  backgroundColor: vars.color.background,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  border: `1px solid ${vars.color.border}`,

  animation: `${slideDown} ${vars.animation.duration.normal} ${vars.animation.easing.default}`,
});

/**
 * Container width variants for different use cases
 */
export const containerWidth = styleVariants({
  sm: { minWidth: '160px', maxWidth: '240px' },
  md: { minWidth: '200px', maxWidth: '320px' },
  lg: { minWidth: '280px', maxWidth: '400px' },
});

/**
 * Menu item - interactive row in the floating menu
 */
export const item = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  cursor: 'pointer',
  transition: `background-color ${vars.animation.duration.fast}`,

  ':hover': {
    backgroundColor: vars.color.backgroundAlt,
  },
});

/**
 * Selected/highlighted menu item state
 */
export const itemSelected = style({
  backgroundColor: vars.color.surface,
});

/**
 * Icon container within menu item
 * Square container with centered content
 */
export const itemIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.md,
  flexShrink: 0,
});

/**
 * Icon shape variants
 */
export const itemIconShape = styleVariants({
  square: { borderRadius: vars.radius.md },
  circle: { borderRadius: vars.radius.full },
});

/**
 * Icon color variants for different contexts
 */
export const itemIconVariant = styleVariants({
  default: {
    backgroundColor: vars.color.surface,
    color: vars.color.foregroundMuted,
  },
  accent: {
    backgroundColor: vars.color.accent,
    color: vars.color.accentForeground,
  },
  warning: {
    backgroundColor: vars.color.warning,
    color: vars.color.background,
  },
  muted: {
    backgroundColor: vars.color.surface,
    color: vars.color.accent,
  },
});

/**
 * Text content area within menu item
 */
export const itemText = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
});

/**
 * Primary label text (when item has label + description)
 */
export const itemLabel = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
});

/**
 * Secondary description text
 */
export const itemDescription = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

/**
 * Empty state when no items match - re-exported from EmptyState primitive
 */
export const emptyState = emptyStateCentered;

/**
 * Loading state container
 */
export const loadingState = style({
  padding: `${vars.spacing['4']} ${vars.spacing['3']}`,
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.spacing['2'],
});

/**
 * Spinner indicator for loading state
 */
export const spinner = style({
  width: '14px',
  height: '14px',
  border: `2px solid ${vars.color.border}`,
  borderTopColor: vars.color.accent,
  borderRadius: vars.radius.full,
  animation: `${spin} 0.6s linear infinite`,
});

/**
 * Divider between menu sections
 */
export const divider = style({
  height: '1px',
  backgroundColor: vars.color.border,
  margin: `${vars.spacing['2']} 0`,
});

/**
 * Section label for grouped items
 */
export const sectionLabel = style({
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

/**
 * Special action item (e.g., "Create new...")
 * Has a top border to separate from regular results
 */
export const actionItem = style({
  borderTop: `1px solid ${vars.color.border}`,
  marginTop: vars.spacing['2'],
  paddingTop: vars.spacing['2'],
});
