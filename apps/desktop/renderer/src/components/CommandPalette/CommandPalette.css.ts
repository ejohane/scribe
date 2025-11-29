/**
 * Command Palette Styles
 *
 * Vanilla-extract styles for the command palette component.
 * Uses design system tokens for consistent theming.
 */

import { style, keyframes, globalStyle } from '@vanilla-extract/css';
import { vars, darkTheme } from '@scribe/design-system';

// Animation keyframes
const slideUp = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(10px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

// Override Overlay default centering for command palette positioning
export const overlayPositioning = style({
  alignItems: 'flex-start',
  paddingTop: '20vh', // Matches POC pt-[20vh]
  backgroundColor: 'rgba(255, 255, 255, 0.6)', // Light mode: bg-white/60
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
});

// Dark mode backdrop - use black/60 instead of white/60
globalStyle(`.${darkTheme} ${overlayPositioning}`, {
  backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dark mode: bg-black/60
});

// Main palette container
export const paletteContainer = style({
  width: '640px', // Fixed width for consistent sizing
  maxWidth: '90vw', // Responsive cap for smaller screens
  maxHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.background,
  borderRadius: vars.radius['2xl'],
  boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px ${vars.color.border}`,
  border: 'none',
  animation: `${slideUp} ${vars.animation.duration.slow} ${vars.animation.easing.default}`,
  margin: `0 ${vars.spacing['4']}`,
  overflow: 'hidden',
});

// Input wrapper with bottom border
export const inputWrapper = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: `${vars.spacing['4']} ${vars.spacing['4']}`,
  borderBottom: `1px solid ${vars.color.border}`,
});

// Search icon styling
export const searchIcon = style({
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});

// ESC badge styling
export const escBadge = style({
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  backgroundColor: vars.color.surface,
  borderRadius: vars.radius.sm,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  flexShrink: 0,
  userSelect: 'none',
});

// Custom input styling (borderless for palette)
export const paletteInput = style({
  flex: 1,
  border: 'none',
  outline: 'none',
  boxShadow: 'none',
  fontSize: vars.typography.size.md,
  fontFamily: vars.typography.fontFamily.ui,
  color: vars.color.foreground,
  background: 'transparent',
  height: '1.5rem',
  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
  ':focus': {
    outline: 'none',
    border: 'none',
    boxShadow: 'none',
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
  cursor: 'pointer',
  flexShrink: 0,
  marginTop: '-2px', // Nudge up to visually center with input text
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
  maxHeight: 'calc(60vh - 60px)',
  padding: vars.spacing['2'],
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
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  cursor: 'pointer',
  transition: `background-color ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  borderRadius: vars.radius.lg,
  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

export const paletteItemSelected = style({
  backgroundColor: vars.color.surface,
});

// Item icon container
export const itemIcon = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '16px',
  height: '16px',
  minWidth: '16px',
  minHeight: '16px',
  flexShrink: 0,
  color: vars.color.foregroundMuted,
});

// Item text container (holds title and description)
export const itemTextContainer = style({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: vars.spacing['2'],
});

// Enter key hint for selected items
export const enterHint = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: vars.color.foregroundMuted,
  flexShrink: 0,
  opacity: 0,
  transition: `opacity ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
});

// Show enter hint on selected/hovered item
export const enterHintVisible = style({
  opacity: 1,
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

// Item description / subtext (hidden by default for cleaner look)
export const itemDescription = style({
  display: 'none',
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

// Create item icon container (for plus icon)
export const createIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: vars.color.foregroundMuted,
});

// Delete icon on note items
export const deleteIcon = style({
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: vars.radius.sm,
  cursor: 'pointer',
  opacity: 0,
  transition: `opacity ${vars.animation.duration.fast} ${vars.animation.easing.default}`,
  color: vars.color.foregroundMuted,
  background: 'transparent',
  border: 'none',
  padding: 0,
  flexShrink: 0,
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

// Primary action button styling (for non-destructive actions)
export const primaryButton = style({
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  border: 'none',
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.accent,
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  ':hover': {
    filter: 'brightness(0.9)',
  },
  ':focus': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

// Prompt input container
export const promptInputContainer = style({
  margin: `${vars.spacing['3']} 0`,
});

// Prompt input field (with border, unlike the command palette search input)
export const promptInputField = style({
  width: '100%',
  padding: `${vars.spacing['3']} ${vars.spacing['4']}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  fontSize: vars.typography.size.md,
  fontFamily: vars.typography.fontFamily.ui,
  color: vars.color.foreground,
  backgroundColor: vars.color.background,
  marginBottom: vars.spacing['4'],
  ':focus': {
    outline: 'none',
    borderColor: vars.color.accent,
    boxShadow: `0 0 0 2px ${vars.color.accent}20`,
  },
  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});
