/**
 * ReferencesWidget component styles
 *
 * Styles for the references widget that displays wiki-links and URLs
 * extracted from note content.
 */

import { style } from '@vanilla-extract/css';
import { vars, emptyStateInline } from '@scribe/design-system';
import { widgetCard, widgetCardHeader, widgetCardIcon, widgetCardTitle } from './shared.css';

/**
 * Card container matching other context panel widgets - re-exported from shared
 */
export const card = widgetCard;

/**
 * Card header with icon and title - re-exported from shared
 */
export const cardHeader = widgetCardHeader;

/**
 * Card icon - re-exported from shared
 */
export const cardIcon = widgetCardIcon;

/**
 * Icon color for references (tertiary/links semantic)
 */
export const cardIconTertiary = style({
  color: vars.color.tertiary,
});

/**
 * Card title - re-exported from shared
 */
export const cardTitle = widgetCardTitle;

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

/**
 * Scrollable reference list container for expanded state
 * Max height allows for ~15 reference items with scroll
 * Matches taskListScrollable from ContextPanel.css.ts
 */
export const referenceListScrollable = style({
  maxHeight: '400px',
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

/**
 * Re-export expandButton from ContextPanel for use in ReferencesWidget
 * This maintains consistency with TasksWidget and LinkedMentions
 */
export { expandButton } from './ContextPanel.css';
