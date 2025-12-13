/**
 * EmptyState Styles
 *
 * Vanilla-extract styles for empty state UI patterns.
 * Provides consistent styling for empty lists, search results, and widgets.
 *
 * Two variants:
 * - `inline`: Compact style for cards/widgets (smaller padding, italic)
 * - `centered`: For floating menus and full-width containers (more padding, centered)
 */

import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

/**
 * Base empty state style
 * Common properties shared across all variants
 */
export const base = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
});

/**
 * Empty state variants for different contexts
 */
export const variants = styleVariants({
  /**
   * Inline variant for cards and widgets
   * Compact padding, italic text, left-aligned
   */
  inline: {
    padding: vars.spacing['2'],
    fontStyle: 'italic',
  },

  /**
   * Centered variant for floating menus and dropdowns
   * More vertical padding, centered text
   */
  centered: {
    padding: `${vars.spacing['4']} ${vars.spacing['3']}`,
    textAlign: 'center',
  },

  /**
   * Full variant for full-page or section empty states
   * Large padding, centered, flex layout
   */
  full: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: vars.spacing['12'],
    textAlign: 'center',
  },
});

/**
 * Standalone style exports for direct usage
 * These combine base + variant for convenience
 */

/**
 * Inline empty state (for widgets/cards)
 * Example: "No backlinks" in context panel
 */
export const emptyStateInline = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  padding: vars.spacing['2'],
  fontStyle: 'italic',
});

/**
 * Centered empty state (for floating menus)
 * Example: "No results" in autocomplete dropdown
 */
export const emptyStateCentered = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  padding: `${vars.spacing['4']} ${vars.spacing['3']}`,
  textAlign: 'center',
});

/**
 * Full empty state (for full-page or section views)
 * Example: "No tasks" in Tasks screen
 */
export const emptyStateFull = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: vars.spacing['12'],
  textAlign: 'center',
});
