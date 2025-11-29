import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Styles for the ErrorBoundary component
 */

export const container = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  minHeight: '200px',
  padding: vars.spacing[4],
});

export const content = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: '400px',
});

export const iconWrapper = style({
  width: '48px',
  height: '48px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.danger,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: vars.spacing[4],
});

export const icon = style({
  color: '#fff',
  fontSize: vars.typography.size.xl,
  fontWeight: vars.typography.weight.bold,
  lineHeight: 1,
});

export const title = style({
  marginBottom: vars.spacing[2],
});

export const message = style({
  marginBottom: vars.spacing[4],
  maxWidth: '300px',
  wordBreak: 'break-word',
});

export const button = style({
  marginTop: vars.spacing[2],
});
