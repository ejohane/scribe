/**
 * MeetingCreatePanel Styles
 *
 * Additional styles specific to MeetingCreatePanel.
 * Uses design system tokens for consistent theming.
 */

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

export const fieldContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
  marginTop: vars.spacing['3'],
});

export const label = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
});

export const actionsRow = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: vars.spacing['2'],
  marginTop: vars.spacing['4'],
});
