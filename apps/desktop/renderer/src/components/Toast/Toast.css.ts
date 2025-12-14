import { style, keyframes, styleVariants } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const slideIn = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(16px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

const slideOut = keyframes({
  from: {
    opacity: 1,
    transform: 'translateY(0)',
  },
  to: {
    opacity: 0,
    transform: 'translateY(16px)',
  },
});

export const container = style({
  position: 'fixed',
  bottom: vars.spacing['6'],
  right: vars.spacing['6'],
  zIndex: vars.zIndex.tooltip,
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
  pointerEvents: 'none',
});

export const toast = style({
  backgroundColor: vars.color.foreground,
  color: vars.color.background,
  padding: `${vars.spacing['3']} ${vars.spacing['4']}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.sm,
  fontSize: vars.typography.size.sm,
  fontFamily: vars.typography.fontFamily.ui,
  lineHeight: vars.typography.lineHeight.normal,
  maxWidth: '400px',
  pointerEvents: 'auto',
  cursor: 'pointer',
  animation: `${slideIn} 0.2s ease-out`,
});

export const toastVariants = styleVariants({
  success: {},
  error: {
    backgroundColor: vars.color.danger,
    color: vars.color.background,
  },
});

export const exiting = style({
  animation: `${slideOut} 0.15s ease-in forwards`,
});
