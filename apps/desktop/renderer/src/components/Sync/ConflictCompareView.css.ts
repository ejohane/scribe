import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

/**
 * Modal container - wider than ConflictListModal for side-by-side comparison
 */
export const container = style({
  width: '900px',
  maxWidth: '95vw',
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.surface,
  borderRadius: vars.radius.lg,
  boxShadow: vars.shadow.lg,
  overflow: 'hidden',
});

/**
 * Header with back button and title
 */
export const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['3'],
  padding: vars.spacing['4'],
  borderBottom: `1px solid ${vars.color.border}`,
});

/**
 * Back button styling
 */
export const backButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['1'],
  flexShrink: 0,
});

/**
 * Header title container
 */
export const headerTitle = style({
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

/**
 * Main content area with side-by-side panels
 */
export const content = style({
  flex: 1,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: vars.spacing['4'],
  padding: vars.spacing['4'],
  overflow: 'hidden',
  minHeight: 0,
});

/**
 * Individual version panel (local or remote)
 */
export const versionPanel = style({
  display: 'flex',
  flexDirection: 'column',
  gap: vars.spacing['3'],
  overflow: 'hidden',
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.background,
});

/**
 * Version panel header with label and timestamp
 */
export const versionHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: vars.spacing['3'],
  borderBottom: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.backgroundAlt,
});

/**
 * Version label (Local/Remote)
 */
export const versionLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
  fontWeight: vars.typography.weight.medium,
  color: vars.color.foreground,
});

/**
 * Local version indicator dot
 */
export const localIndicator = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.accent,
});

/**
 * Remote version indicator dot
 */
export const remoteIndicator = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: vars.color.warning,
});

/**
 * Timestamp display
 */
export const timestamp = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
});

/**
 * Content preview area - scrollable
 */
export const versionContent = style({
  flex: 1,
  overflow: 'auto',
  padding: vars.spacing['3'],
  fontSize: vars.typography.size.sm,
  lineHeight: vars.typography.lineHeight.relaxed,
  color: vars.color.foreground,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
});

/**
 * Empty content placeholder
 */
export const emptyContent = style({
  color: vars.color.foregroundMuted,
  fontStyle: 'italic',
});

/**
 * Keep this version button - positioned at bottom of panel
 */
export const keepButton = style({
  margin: vars.spacing['3'],
  marginTop: 0,
});

/**
 * Footer with additional options
 */
export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: vars.spacing['4'],
  borderTop: `1px solid ${vars.color.border}`,
  gap: vars.spacing['3'],
});

/**
 * Footer actions container
 */
export const footerActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: vars.spacing['2'],
});

/**
 * Truncation notice
 */
export const truncationNotice = style({
  fontSize: vars.typography.size.xs,
  color: vars.color.foregroundMuted,
  fontStyle: 'italic',
  padding: `${vars.spacing['2']} ${vars.spacing['3']}`,
  borderTop: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.backgroundAlt,
});
