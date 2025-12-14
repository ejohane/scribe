import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

const slideIn = keyframes({
  from: {
    opacity: 0,
    transform: 'translateX(100%)',
  },
  to: {
    opacity: 1,
    transform: 'translateX(0)',
  },
});

const slideOut = keyframes({
  from: {
    opacity: 1,
    transform: 'translateX(0)',
  },
  to: {
    opacity: 0,
    transform: 'translateX(100%)',
  },
});

export const container = style({
  position: 'fixed',
  bottom: vars.spacing['6'],
  right: vars.spacing['6'],
  zIndex: vars.zIndex.tooltip,
  pointerEvents: 'none',
});

export const card = style({
  backgroundColor: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  padding: vars.spacing['4'],
  width: '280px',
  pointerEvents: 'auto',
  animation: `${slideIn} 0.3s ease-out`,
});

export const cardExiting = style({
  animation: `${slideOut} 0.2s ease-in forwards`,
});

export const header = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: vars.spacing['2'],
});

export const title = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.bold,
  color: vars.color.foreground,
  margin: 0,
});

export const closeButton = style({
  background: 'none',
  border: 'none',
  padding: vars.spacing['1'],
  cursor: 'pointer',
  color: vars.color.foregroundMuted,
  borderRadius: vars.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 0.15s ease, background-color 0.15s ease',
  marginTop: `calc(-1 * ${vars.spacing['1']})`,
  marginRight: `calc(-1 * ${vars.spacing['1']})`,
  ':hover': {
    color: vars.color.foreground,
    backgroundColor: vars.color.backgroundAlt,
  },
});

export const message = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  lineHeight: vars.typography.lineHeight.relaxed,
  margin: 0,
  marginBottom: vars.spacing['3'],
});

export const button = style({
  width: '100%',
});
