/**
 * Command Palette Styles
 *
 * Vanilla-extract styles for the command palette.
 * Uses design tokens for consistent theming.
 */

import { style, keyframes, styleVariants, globalStyle } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

// ============================================================================
// Keyframe Animations
// ============================================================================

/**
 * Slide up animation for palette entrance.
 */
export const slideUp = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(8px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

/**
 * Spinner animation for loading state.
 */
export const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

// ============================================================================
// Container Styles
// ============================================================================

/**
 * Backdrop/overlay behind the palette.
 */
export const backdrop = style({
  position: 'fixed',
  inset: 0,
  zIndex: vars.zIndex.palette,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '15vh',
  backgroundColor: vars.color.backdropLight,
  backdropFilter: `blur(${vars.blur.lg})`,
  WebkitBackdropFilter: `blur(${vars.blur.lg})`,
});

/**
 * Main palette container.
 */
export const container = style({
  width: '100%',
  maxWidth: '520px',
  maxHeight: '60vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.background,
  borderRadius: vars.radius['2xl'],
  boxShadow: vars.shadow.xl,
  border: `1px solid ${vars.color.border}`,
  overflow: 'hidden',
  animation: `${slideUp} 150ms ${vars.animation.easing.smooth}`,
});

// ============================================================================
// Input Styles
// ============================================================================

/**
 * Input wrapper container.
 */
export const inputWrapper = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: `${vars.spacing['4']} ${vars.spacing['4']}`,
  borderBottom: `1px solid ${vars.color.border}`,
  outline: 'none',
  ':focus-within': {
    outline: 'none',
  },
});

/**
 * Search icon in input.
 */
export const inputIcon = style({
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});

/**
 * Search input field.
 */
export const input = style({
  flex: 1,
  border: 'none',
  background: 'transparent',
  outline: 'none',
  boxShadow: 'none',
  fontSize: vars.typography.size.md,
  fontFamily: vars.typography.fontFamily.ui,
  color: vars.color.foreground,

  ':focus': {
    outline: 'none',
    boxShadow: 'none',
  },

  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

/**
 * Keyboard shortcut hint in input.
 */
export const inputHint = style({
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.xs,
  flexShrink: 0,
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  backgroundColor: vars.color.surface,
  borderRadius: vars.radius.sm,
  fontFamily: vars.typography.fontFamily.mono,
});

// ============================================================================
// Results Styles
// ============================================================================

/**
 * Results container.
 */
export const results = style({
  flex: 1,
  overflow: 'auto',
  padding: `${vars.spacing['2']} 0`,
});

/**
 * Empty state message.
 */
export const emptyState = style({
  padding: `${vars.spacing['6']} ${vars.spacing['4']}`,
  textAlign: 'center',
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
});

/**
 * Loading state container.
 */
export const loadingState = style({
  padding: `${vars.spacing['4']} ${vars.spacing['4']}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: vars.spacing['2'],
  color: vars.color.foregroundMuted,
  fontSize: vars.typography.size.sm,
});

/**
 * Loading spinner.
 */
export const spinner = style({
  width: vars.component.spinner.size,
  height: vars.component.spinner.size,
  border: `2px solid ${vars.color.border}`,
  borderTopColor: vars.color.accent,
  borderRadius: vars.radius.full,
  animation: `${spin} 0.6s linear infinite`,
});

// ============================================================================
// Section Styles
// ============================================================================

/**
 * Section container.
 */
export const section = style({
  selectors: {
    '& + &': {
      marginTop: vars.spacing['2'],
    },
  },
});

/**
 * Section label/header.
 */
export const sectionLabel = style({
  padding: `${vars.spacing['2']} ${vars.spacing['6']}`,
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  textTransform: 'uppercase',
  letterSpacing: vars.typography.letterSpacing.wide,
});

// ============================================================================
// Item Styles
// ============================================================================

/**
 * Item container.
 */
export const item = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: `${vars.spacing['3']} ${vars.spacing['4']}`,
  cursor: 'pointer',
  borderRadius: vars.radius.lg,
  margin: `0 ${vars.spacing['2']}`,
  transition: `background-color ${vars.animation.duration.fast}`,

  ':hover': {
    backgroundColor: vars.color.surface,
  },
});

/**
 * Selected item state.
 */
export const itemSelected = style({
  backgroundColor: vars.color.surface,
});

/**
 * Item icon container.
 */
export const itemIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  color: vars.color.foregroundMuted,
  flexShrink: 0,
});

/**
 * Icon variants for different contexts.
 */
export const itemIconVariant = styleVariants({
  default: {
    color: vars.color.foregroundMuted,
  },
  accent: {
    color: vars.color.accent,
  },
  note: {
    color: vars.color.foregroundMuted,
  },
  daily: {
    color: vars.color.foregroundMuted,
  },
  meeting: {
    color: vars.color.foregroundMuted,
  },
  person: {
    color: vars.color.foregroundMuted,
  },
});

/**
 * Item content container (label + description).
 */
export const itemContent = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
});

/**
 * Item label/title.
 */
export const itemLabel = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

/**
 * Item description/subtitle.
 */
export const itemDescription = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  marginTop: vars.spacing['1'],
});

/**
 * Item shortcut container - aligns to right with unified background.
 */
export const itemShortcut = style({
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  flexShrink: 0,
  marginLeft: 'auto',
  padding: '4px 8px',
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
});

/**
 * Individual keyboard key character.
 */
export const keyboardKey = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  color: vars.color.foregroundMuted,
  lineHeight: 1,
});

// ============================================================================
// Footer Styles
// ============================================================================

/**
 * Footer container with keyboard hints.
 */
export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: vars.spacing['4'],
  padding: `${vars.spacing['2']} ${vars.spacing['4']}`,
  borderTop: `1px solid ${vars.color.border}`,
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

/**
 * Footer hint group.
 */
export const footerHint = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
});

/**
 * Footer keyboard key.
 */
export const footerKey = style({
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  backgroundColor: vars.color.surface,
  borderRadius: vars.radius.sm,
  fontFamily: vars.typography.fontFamily.mono,
});

// Ensure scrollbar styling
globalStyle(`${results}::-webkit-scrollbar`, {
  width: '8px',
});

globalStyle(`${results}::-webkit-scrollbar-track`, {
  background: 'transparent',
});

globalStyle(`${results}::-webkit-scrollbar-thumb`, {
  background: vars.color.border,
  borderRadius: vars.radius.full,
});

globalStyle(`${results}::-webkit-scrollbar-thumb:hover`, {
  background: vars.color.foregroundMuted,
});
