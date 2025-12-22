import { style, globalStyle } from '@vanilla-extract/css';
import { vars } from '../../tokens/contract.css';

/**
 * Calendar component styles for react-day-picker v9.
 *
 * Uses design system tokens for consistent theming.
 * Minimum 32x32px touch targets for day cells.
 */

// Root container
export const root = style({
  fontFamily: vars.typography.fontFamily.ui,
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
  backgroundColor: vars.color.background,
  padding: vars.spacing['3'],
  borderRadius: vars.radius.lg,
  userSelect: 'none',
});

// Months container (for single month)
export const months = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['4'],
});

// Individual month container
export const month = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
});

// Month caption container (header with nav and label)
export const monthCaption = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  height: '32px',
  marginBottom: vars.spacing['2'],
});

// Caption label (e.g., "December 2024")
export const captionLabel = style({
  fontSize: vars.typography.size.md,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
});

// Navigation container
export const nav = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  position: 'absolute',
  left: 0,
  right: 0,
  justifyContent: 'space-between',
  padding: `0 ${vars.spacing['1']}`,
});

// Navigation buttons (prev/next)
export const navButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  padding: 0,
  border: 'none',
  borderRadius: vars.radius.md,
  backgroundColor: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  transition: `background-color ${vars.animation.duration.fast}, color ${vars.animation.duration.fast}`,
  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },
  ':focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${vars.color.background}, 0 0 0 4px ${vars.color.accent}`,
  },
  ':disabled': {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
});

// Month grid (table)
export const table = style({
  width: '100%',
  borderCollapse: 'collapse',
  borderSpacing: 0,
});

// Weekday header row
export const headRow = style({
  display: 'flex',
  marginBottom: vars.spacing['1'],
});

// Weekday header cell
export const headCell = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '32px',
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  textTransform: 'uppercase',
  letterSpacing: vars.typography.letterSpacing.wide,
});

// Week row
export const row = style({
  display: 'flex',
  width: '100%',
  marginTop: vars.spacing['1'],
});

// Day cell wrapper
export const cell = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1px',
});

// Day button (the clickable element)
export const dayButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: 0,
  border: 'none',
  borderRadius: vars.radius.md,
  backgroundColor: 'transparent',
  color: vars.color.foreground,
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.regular,
  cursor: 'pointer',
  transition: `background-color ${vars.animation.duration.fast}, transform ${vars.animation.duration.fast}, color ${vars.animation.duration.fast}`,
  ':hover': {
    backgroundColor: vars.color.surface,
    transform: 'scale(1.05)',
  },
  ':focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${vars.color.background}, 0 0 0 4px ${vars.color.accent}`,
  },
});

// Selected day state
export const daySelected = style({});

// Today state
export const dayToday = style({});

// Disabled day state
export const dayDisabled = style({});

// Outside month day state
export const dayOutside = style({});

// Use globalStyle for compound selectors that Vanilla Extract doesn't support directly
// Selected day button
globalStyle(`${cell}.${daySelected} ${dayButton}`, {
  backgroundColor: vars.color.accent,
  color: vars.color.accentForeground,
  fontWeight: vars.typography.weight.medium,
});

globalStyle(`${cell}.${daySelected} ${dayButton}:hover`, {
  backgroundColor: vars.color.accent,
  filter: 'brightness(0.9)',
});

// Today indicator (ring around the day)
globalStyle(`${cell}.${dayToday} ${dayButton}`, {
  boxShadow: `inset 0 0 0 1px ${vars.color.accent}`,
});

// Today + Selected (selected takes priority but keep today ring visible)
globalStyle(`${cell}.${dayToday}.${daySelected} ${dayButton}`, {
  boxShadow: 'none',
});

// Disabled day
globalStyle(`${cell}.${dayDisabled} ${dayButton}`, {
  opacity: 0.3,
  cursor: 'not-allowed',
});

globalStyle(`${cell}.${dayDisabled} ${dayButton}:hover`, {
  transform: 'none',
  backgroundColor: 'transparent',
});

// Outside month days (days from prev/next month shown in current view)
globalStyle(`${cell}.${dayOutside} ${dayButton}`, {
  color: vars.color.foregroundMuted,
  opacity: 0.5,
});
