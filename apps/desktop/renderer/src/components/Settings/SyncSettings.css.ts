import { style, keyframes } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * SyncSettings styles
 * Layout for the sync settings section with account management
 */

/** Container for all sync settings groups */
export const syncSettings = style({
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

/** Button group for actions */
export const buttonGroup = style({
  display: 'flex',
  gap: vars.spacing['2'],
  marginTop: vars.spacing['2'],
});

/** Error message text */
export const errorMessage = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.danger,
  marginTop: vars.spacing['2'],
});

/** Success message text */
export const successMessage = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.success,
  marginTop: vars.spacing['2'],
});

/* Sync status section styles */

/** Benefits list for disabled sync state */
export const benefitsList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['2'],
  marginTop: vars.spacing['2'],
  marginBottom: vars.spacing['4'],
});

/** Individual benefit item */
export const benefitItem = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: vars.spacing['2'],
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
});

/** Benefit icon container */
export const benefitIcon = style({
  flexShrink: 0,
  color: vars.color.accent,
  marginTop: '2px',
});

/* Login form styles */

/** Login form container */
export const loginForm = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['4'],
});

/** Form field container */
export const formField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['1'],
});

/** Form field label */
export const formLabel = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
});

/** Text input field */
export const textInput = style({
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  fontSize: vars.typography.size.sm,
  color: vars.color.foreground,
  backgroundColor: vars.color.backgroundAlt,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  outline: 'none',
  transition: `border-color ${vars.animation.duration.fast}`,

  ':focus': {
    borderColor: vars.color.accent,
  },

  '::placeholder': {
    color: vars.color.foregroundMuted,
  },
});

/** Form actions row */
export const formActions = style({
  display: 'flex',
  gap: vars.spacing['2'],
  marginTop: vars.spacing['2'],
});

/* Account info styles */

/** Account info container */
export const accountInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: vars.spacing['3'],
  backgroundColor: vars.color.backgroundAlt,
  borderRadius: vars.radius.md,
  marginBottom: vars.spacing['3'],
});

/** Account avatar placeholder */
export const accountAvatar = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: vars.radius.full,
  backgroundColor: vars.color.accent,
  color: vars.color.background,
  flexShrink: 0,
});

/** Account details column */
export const accountDetails = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['0'],
  flex: 1,
  minWidth: 0,
});

/** Account email text */
export const accountEmail = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

/** Account status text */
export const accountStatus = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

/** Sync mode toggle container */
export const syncModeToggle = style({
  display: 'flex',
  alignItems: 'center',
});

/* Confirmation dialog styles */

/** Confirmation dialog container */
export const confirmDialog = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['4'],
  maxWidth: '400px',
});

/** Confirmation dialog buttons */
export const confirmDialogButtons = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: vars.spacing['2'],
  marginTop: vars.spacing['2'],
});

/** Warning text in confirmation dialog */
export const warningText = style({
  fontSize: vars.typography.size.sm,
  color: vars.color.warning,
  lineHeight: vars.typography.lineHeight.relaxed,
});

/* Sync status indicator styles */

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

/** Status indicator container */
export const statusIndicator = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  fontSize: vars.typography.size.sm,
  color: vars.color.foregroundMuted,
});

/** Spinning sync icon */
export const syncingIcon = style({
  animation: `${spin} 1s linear infinite`,
});

/** Last sync time text */
export const lastSyncTime = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  marginTop: vars.spacing['1'],
});

/** Danger zone section */
export const dangerZone = style({
  marginTop: vars.spacing['4'],
  paddingTop: vars.spacing['4'],
  borderTop: `1px solid ${vars.color.border}`,
});

/** Danger zone title */
export const dangerZoneTitle = style({
  fontSize: vars.typography.size.sm,
  fontWeight: vars.typography.weight.medium,
  color: vars.color.danger,
  marginBottom: vars.spacing['2'],
});
