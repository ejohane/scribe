/**
 * SlashMenu Styles
 *
 * Vanilla-extract styles for the slash command menu.
 * Appears below cursor when user types "/" at start of line or after space.
 */

import { style, keyframes } from '@vanilla-extract/css';

const fadeIn = keyframes({
  from: { opacity: 0, transform: 'translateY(-4px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

export const menu = style({
  position: 'fixed',
  zIndex: 1000,
  minWidth: '280px',
  maxWidth: '320px',
  maxHeight: '300px',
  overflow: 'auto',
  backgroundColor: 'var(--background, #1c1c1e)',
  borderRadius: '8px',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
  border: '1px solid var(--border, #3a3a3c)',
  animation: `${fadeIn} 150ms ease-out`,
});

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px 12px',
  cursor: 'pointer',
  transition: 'background-color 100ms',
  ':hover': {
    backgroundColor: 'var(--background-alt, #2c2c2e)',
  },
});

export const menuItemSelected = style({
  backgroundColor: 'var(--surface, #2c2c2e)',
});

export const menuItemIcon = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '6px',
  backgroundColor: 'var(--surface, #3a3a3c)',
  color: 'var(--foreground, #f5f5f7)',
  flexShrink: 0,
});

export const menuItemIconPlugin = style({
  backgroundColor: 'var(--accent, #5856d6)',
  color: 'var(--background, #ffffff)',
});

export const menuItemText = style({
  flex: 1,
  minWidth: 0,
});

export const menuItemLabel = style({
  fontSize: '14px',
  fontWeight: 500,
  color: 'var(--foreground, #f5f5f7)',
});

export const menuItemDescription = style({
  fontSize: '12px',
  color: 'var(--foreground-muted, #a1a1a6)',
});

export const emptyState = style({
  padding: '16px',
  textAlign: 'center',
  color: 'var(--foreground-muted, #a1a1a6)',
  fontSize: '14px',
});

export const divider = style({
  height: '1px',
  backgroundColor: 'var(--border, #3a3a3c)',
  margin: '8px 0',
});

export const sectionLabel = style({
  padding: '8px 12px',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--foreground-muted, #a1a1a6)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

export const loadingIndicator = style({
  padding: '8px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  color: 'var(--foreground-muted, #a1a1a6)',
});

const spin = keyframes({
  to: { transform: 'rotate(360deg)' },
});

export const loadingSpinner = style({
  width: '14px',
  height: '14px',
  border: '2px solid var(--border, #3a3a3c)',
  borderTopColor: 'var(--accent, #5856d6)',
  borderRadius: '50%',
  animation: `${spin} 0.8s linear infinite`,
});
