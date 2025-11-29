import { keyframes, style } from '@vanilla-extract/css';
import { vars } from './contract.css';

// ============================================================================
// Keyframes
// ============================================================================

/**
 * fadeIn - Simple opacity fade
 * Used for: Editor content, floating menus
 */
export const fadeIn = keyframes({
  '0%': { opacity: 0 },
  '100%': { opacity: 1 },
});

/**
 * slideUp - Fade with upward movement
 * Used for: Command palette, toasts
 */
export const slideUp = keyframes({
  '0%': { opacity: 0, transform: 'translateY(10px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

/**
 * slideDown - Fade with downward movement
 * Used for: Dropdowns, menus appearing from above
 */
export const slideDown = keyframes({
  '0%': { opacity: 0, transform: 'translateY(-10px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

/**
 * enter - Composite animation with CSS custom properties
 * Used for: Selection toolbar (fade + scale)
 * Configure with --enter-opacity and --enter-scale CSS variables
 */
export const enter = keyframes({
  from: {
    opacity: 'var(--enter-opacity, 1)',
    transform: 'scale3d(var(--enter-scale, 1), var(--enter-scale, 1), 1)',
  },
});

/**
 * spin - Continuous rotation
 * Used for: Loading spinners
 */
export const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

// ============================================================================
// Utility Styles
// ============================================================================

/**
 * Pre-composed animation utility classes
 * Use these for common animations, or compose your own using the keyframes
 */

export const animateFadeIn = style({
  animation: `${fadeIn} ${vars.animation.duration.normal} ${vars.animation.easing.default} forwards`,
});

export const animateSlideUp = style({
  animation: `${slideUp} ${vars.animation.duration.slow} ${vars.animation.easing.default} forwards`,
});

export const animateSlideDown = style({
  animation: `${slideDown} ${vars.animation.duration.slow} ${vars.animation.easing.default} forwards`,
});

export const animateSpin = style({
  animation: `${spin} 1s linear infinite`,
});

// ============================================================================
// Accessibility: Reduced Motion Support
// ============================================================================

/**
 * Respects user's prefers-reduced-motion setting
 *
 * Note: vanilla-extract globalStyle doesn't support @media queries directly.
 * Projects should add this to their global CSS or use a CSS-in-JS media query:
 *
 * @media (prefers-reduced-motion: reduce) {
 *   *, *::before, *::after {
 *     animation-duration: 0.01ms !important;
 *     animation-iteration-count: 1 !important;
 *     transition-duration: 0.01ms !important;
 *   }
 * }
 */
