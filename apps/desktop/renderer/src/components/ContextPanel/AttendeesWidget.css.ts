/**
 * AttendeesWidget component styles
 *
 * Styles for the attendees widget that displays and manages meeting attendees.
 * Uses card-based styling consistent with other context panel widgets.
 */

import { style } from '@vanilla-extract/css';
import { vars, emptyStateInline } from '@scribe/design-system';
import { widgetCard, widgetCardHeader, widgetCardIcon, widgetCardTitle } from './shared.css';

/**
 * Card container matching other context panel widgets - re-exported from shared
 */
export const card = widgetCard;

/**
 * Card header with icon, title, and add button - re-exported from shared
 */
export const cardHeader = widgetCardHeader;

/**
 * Card icon - re-exported from shared
 */
export const cardIcon = widgetCardIcon;

/**
 * Icon color for attendees (secondary/people semantic)
 */
export const cardIconSecondary = style({
  color: vars.color.secondary,
});

/**
 * Card title with flex: 1 for add button positioning
 * Extends shared title with additional flex property
 */
export const cardTitle = style([
  widgetCardTitle,
  {
    flex: 1,
  },
]);

/**
 * Add button in header
 */
export const addButton = style({
  background: 'none',
  border: 'none',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.lg,
  cursor: 'pointer',
  padding: vars.spacing['1'],
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },
});

/**
 * Autocomplete container for adding attendees
 */
export const autocomplete = style({
  marginBottom: vars.spacing['3'],
});

/**
 * Search input for finding people
 */
export const searchInput = style({
  width: '100%',
  padding: vars.spacing['2'],
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.sm,
  backgroundColor: vars.color.surface,
  color: vars.color.foreground,
  fontSize: vars.typography.size.sm,
  marginBottom: vars.spacing['2'],
  transition: `border-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':focus': {
    outline: 'none',
    borderColor: vars.color.accent,
  },

  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

/**
 * Suggestions list container
 */
export const suggestionsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
  maxHeight: '150px',
  overflowY: 'auto',
});

/**
 * Individual suggestion item (clickable button)
 */
export const suggestionItem = style({
  display: 'flex',
  alignItems: 'center',
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
 * No results message
 */
export const noResults = style({
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
  fontStyle: 'italic',
  padding: vars.spacing['2'],
});

/**
 * Create new person option in suggestions list
 */
export const createOption = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: vars.spacing['2'],
  borderRadius: vars.radius.sm,
  background: 'none',
  border: 'none',
  color: vars.color.accent,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  fontSize: vars.typography.size.sm,
  borderTop: `1px solid ${vars.color.border}`,
  marginTop: vars.spacing['1'],
  paddingTop: vars.spacing['2'],
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

/**
 * Plus icon for create option
 */
export const createIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.surface,
  color: vars.color.accent,
  fontSize: vars.typography.size.md,
  flexShrink: 0,
});

/**
 * List of current attendees
 */
export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

/**
 * Individual attendee row with name and remove button
 */
export const attendeeRow = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: vars.spacing['2'],
  borderRadius: vars.radius.sm,
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

/**
 * Attendee name button (clickable to navigate)
 */
export const attendeeName = style({
  background: 'none',
  border: 'none',
  color: vars.color.foreground,
  cursor: 'pointer',
  padding: 0,
  fontSize: vars.typography.size.sm,
  textAlign: 'left',

  ':hover': {
    textDecoration: 'underline',
  },
});

/**
 * Remove button (× icon), only visible on row hover
 */
export const removeButton = style({
  background: 'none',
  border: 'none',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  padding: vars.spacing['1'],
  fontSize: vars.typography.size.md,
  lineHeight: 1,
  opacity: 0,
  transition: `all ${vars.animation.duration.fast} ${vars.animation.easing.default}`,

  selectors: {
    [`${attendeeRow}:hover &`]: {
      opacity: 1,
    },
  },

  ':hover': {
    color: vars.color.danger,
  },
});

/**
 * Empty state message - re-exported from design system
 */
export const emptyState = emptyStateInline;
