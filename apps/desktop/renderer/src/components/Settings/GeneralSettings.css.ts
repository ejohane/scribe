import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * GeneralSettings styles
 * Layout for the general settings section with grouped settings
 */

/** Container for all settings groups */
export const generalSettings = style({
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

/** Row for a single setting item */
export const settingRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: vars.spacing['4'],
});

/** Label/description side of a setting row */
export const settingLabel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
  flex: 1,
});

/** Primary label text */
export const settingLabelText = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
});

/** Secondary description text */
export const settingLabelDescription = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

/** Control side of a setting row */
export const settingControl = style({
  flexShrink: 0,
});

/** Vault path display (monospace) */
export const vaultPath = style({
  fontFamily: vars.typography.fontFamily.mono,
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  backgroundColor: vars.color.backgroundAlt,
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  borderRadius: vars.radius.md,
  wordBreak: 'break-all',
});

/** Button group for actions */
export const buttonGroup = style({
  display: 'flex',
  gap: vars.spacing['2'],
  marginTop: vars.spacing['2'],
});

/** Version text display */
export const versionText = style({
  fontSize: vars.typography.size.md,
  fontFamily: vars.typography.fontFamily.mono,
  color: vars.color.foreground,
});

/** Placeholder/loading state */
export const placeholder = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
  fontStyle: 'italic',
});

/** Theme setting container */
export const themeSetting = style({
  display: 'flex',
  alignItems: 'center',
});

/** Restart dialog container */
export const restartDialog = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['4'],
  maxWidth: '400px',
});

/** Restart dialog button group */
export const restartDialogButtons = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: vars.spacing['2'],
  marginTop: vars.spacing['2'],
});

/** Error message text */
export const errorMessage = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.danger,
  marginTop: vars.spacing['2'],
});

/** Version setting container */
export const versionSetting = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
});

/** Version row with version text and button */
export const versionRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
});

/** Update controls row */
export const updateControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
});

/** Success message text */
export const successMessage = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.success,
});
