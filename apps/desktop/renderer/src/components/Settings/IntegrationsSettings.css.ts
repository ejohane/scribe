import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * IntegrationsSettings styles
 * Layout for the integrations settings section
 */

/** Container for all settings groups */
export const integrationsSettings = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['8'],
  maxWidth: '600px',
});

/** Individual settings group container */
export const settingsGroup = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['3'],
});

/** Header for a settings group (title and optional description) */
export const settingsGroupHeader = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
  borderBottom: `1px solid ${vars.color.border}`,
  paddingBottom: vars.spacing['2'],
});

/** Title of a settings group */
export const settingsGroupTitle = style({
  fontSize: vars.typography.size.lg,
  fontWeight: vars.typography.weight.bold,
  color: vars.color.foreground,
});

/** Optional description text for a settings group */
export const settingsGroupDescription = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  lineHeight: vars.typography.lineHeight.relaxed,
});

/** Content area for the setting controls */
export const settingsGroupContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['3'],
});

/** Individual integration item */
export const integrationItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['3'],
  padding: vars.spacing['4'],
  backgroundColor: vars.color.backgroundAlt,
  borderRadius: vars.radius.lg,
});

/** Header row with info and status */
export const integrationHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: vars.spacing['4'],
});

/** Info section (name and description) */
export const integrationInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
  flex: 1,
});

/** Status badge - installed */
export const statusInstalled = style({
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.success,
  backgroundColor: `color-mix(in srgb, ${vars.color.success} 15%, transparent)`,
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  borderRadius: vars.radius.full,
  whiteSpace: 'nowrap',
});

/** Status badge - not installed */
export const statusNotInstalled = style({
  fontSize: vars.typography.size.xs,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foregroundMuted,
  backgroundColor: vars.color.backgroundAlt,
  border: `1px solid ${vars.color.border}`,
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  borderRadius: vars.radius.full,
  whiteSpace: 'nowrap',
});

/** Button group for actions */
export const buttonGroup = style({
  display: 'flex',
  gap: vars.spacing['2'],
});

/** Code inline style */
export const code = style({
  fontFamily: vars.typography.fontFamily.mono,
  fontSize: vars.typography.size.sm,
  backgroundColor: vars.color.background,
  padding: `2px ${vars.spacing['1']}`,
  borderRadius: vars.radius.sm,
});

/** Path info text */
export const pathInfo = style({
  marginTop: vars.spacing['1'],
});

/** Placeholder/loading state */
export const placeholder = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  fontStyle: 'italic',
  padding: vars.spacing['4'],
});

/** Success message */
export const successMessage = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.success,
  padding: vars.spacing['2'],
  backgroundColor: `color-mix(in srgb, ${vars.color.success} 10%, transparent)`,
  borderRadius: vars.radius.md,
});

/** Error message */
export const errorMessage = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.danger,
  padding: vars.spacing['2'],
  backgroundColor: `color-mix(in srgb, ${vars.color.danger} 10%, transparent)`,
  borderRadius: vars.radius.md,
});

/** Warning message */
export const warningMessage = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.warning,
  padding: vars.spacing['2'],
  backgroundColor: `color-mix(in srgb, ${vars.color.warning} 10%, transparent)`,
  borderRadius: vars.radius.md,
});

/** Prerequisite warning box */
export const prerequisiteWarning = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
  padding: vars.spacing['3'],
  backgroundColor: vars.color.background,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
});

/** Link style */
export const link = style({
  color: vars.color.accent,
  textDecoration: 'none',
  ':hover': {
    textDecoration: 'underline',
  },
});
