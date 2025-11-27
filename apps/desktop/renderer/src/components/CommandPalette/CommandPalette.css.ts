/**
 * Command Palette Styles
 *
 * Vanilla-extract styles for the command palette component.
 * Uses design system tokens for consistent theming.
 */

import { style, keyframes, globalStyle } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

// Animation keyframes
const slideDown = keyframes({
  from: {
    transform: 'translateY(-20px)',
    opacity: 0,
  },
  to: {
    transform: 'translateY(0)',
    opacity: 1,
  },
});

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

// Override Overlay default centering for command palette positioning
export const overlayPositioning = style({
  alignItems: 'flex-start',
  paddingTop: '15vh',
});

// Main palette container
export const paletteContainer = style({
  width: '40vw',
  maxWidth: '640px',
  maxHeight: '70vh',
  display: 'flex',
  flexDirection: 'column',
  animation: `${slideDown} 200ms ease-out`,
});

// Input wrapper with bottom border
export const inputWrapper = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  padding: vars.spacing['4'],
  borderBottom: `1px solid ${vars.color.border}`,
});

// Custom input styling (borderless for palette)
export const paletteInput = style({
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: vars.typography.size.md,
  fontFamily: vars.typography.fontFamily.ui,
  color: vars.color.foreground,
  background: 'transparent',
  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

// Back button
export const backButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  padding: 0,
  border: 'none',
  borderRadius: vars.radius.sm,
  background: 'transparent',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.md,
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background-color 0.15s ease, color 0.15s ease',
  ':hover': {
    backgroundColor: vars.color.surface,
    color: vars.color.foreground,
  },
  ':focus': {
    outline: 'none',
    backgroundColor: vars.color.border,
  },
});

// Results container
export const resultsContainer = style({
  overflowY: 'auto',
  maxHeight: 'calc(70vh - 60px)',
  padding: `${vars.spacing['2']} 0`,
  // Hide scrollbar while maintaining scroll functionality
  scrollbarWidth: 'none', // Firefox
});

// Hide webkit scrollbar (Chrome/Safari/Electron)
globalStyle(`${resultsContainer}::-webkit-scrollbar`, {
  display: 'none',
});

// No results message
export const noResults = style({
  padding: vars.spacing['4'],
  textAlign: 'center',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
});

// Separator for sections
export const separator = style({
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.bold,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: vars.color.foregroundMuted,
  backgroundColor: vars.color.backgroundAlt,
  borderTop: `1px solid ${vars.color.border}`,
  borderBottom: `1px solid ${vars.color.border}`,
});

// Palette item (command or note)
export const paletteItem = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
  padding: `${vars.spacing['3']} ${vars.spacing['4']}`,
  cursor: 'pointer',
  transition: 'background-color 0.1s ease',
  borderLeft: '3px solid transparent',
  ':hover': {
    backgroundColor: vars.color.surface,
    borderLeftColor: vars.color.accent,
  },
});

export const paletteItemSelected = style({
  backgroundColor: vars.color.surface,
  borderLeftColor: vars.color.accent,
});

// Item title
export const itemTitle = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// Item description / subtext
export const itemDescription = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

// Delete icon on note items
export const deleteIcon = style({
  position: 'absolute',
  right: vars.spacing['3'],
  top: '50%',
  transform: 'translateY(-50%)',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  opacity: 0,
  transition: 'opacity 0.15s ease',
  color: vars.color.foregroundMuted,
  background: 'transparent',
  border: 'none',
  padding: 0,
  ':hover': {
    color: vars.color.danger,
    backgroundColor: 'rgba(185, 74, 72, 0.1)',
  },
  ':focus': {
    outline: `2px solid ${vars.color.danger}`,
    outlineOffset: '1px',
    opacity: 1,
  },
});

// Show delete icon on hover
globalStyle(`${paletteItem}:hover ${deleteIcon}`, {
  opacity: 1,
});

// Hide delete icon when item is keyboard-selected but NOT hovered
globalStyle(`${paletteItem}${paletteItemSelected}:not(:hover) ${deleteIcon}`, {
  opacity: 0,
});

export const deleteIconSvg = style({
  width: '16px',
  height: '16px',
});

// Delete confirmation screen
export const deleteConfirmation = style({
  padding: vars.spacing['6'],
  textAlign: 'center',
  animation: `${fadeIn} 150ms ease-out`,
});

export const deleteConfirmationTitle = style({
  fontSize: vars.typography.size.md,
  fontWeight: vars.typography.weight.bold,
  marginBottom: vars.spacing['2'],
  color: vars.color.foreground,
});

export const deleteConfirmationMessage = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  marginBottom: vars.spacing['4'],
});

export const deleteConfirmationActions = style({
  display: 'flex',
  justifyContent: 'center',
  gap: vars.spacing['2'],
});

// Cancel button styling
export const cancelButton = style({
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.background,
  color: vars.color.foreground,
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  ':hover': {
    backgroundColor: vars.color.surface,
  },
  ':focus': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
});

// Confirm (danger) button styling
export const confirmButton = style({
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  border: 'none',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.danger,
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  ':hover': {
    filter: 'brightness(0.9)',
  },
  ':focus': {
    outline: `2px solid ${vars.color.danger}`,
    outlineOffset: '2px',
  },
});
