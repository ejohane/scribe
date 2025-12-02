import { style, globalStyle } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

// Main editor container
export const editorRoot = style({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: vars.color.background,
});

export const editorContainer = style({
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '800px',
  margin: '0 auto',
});

export const editorInput = style({
  flex: 1,
  outline: 'none',
  // Note: Top padding reduced since NoteHeader and mainContent provide titlebar clearance
  // Bottom padding: 75vh allows scrolling ~3/4 up the screen from the last line
  padding: `${vars.spacing['4']} ${vars.spacing['8']} 75vh ${vars.spacing['8']}`,
  fontSize: vars.typography.size.lg,
  lineHeight: vars.typography.lineHeight.relaxed,
  fontFamily: vars.typography.fontFamily.ui,
  // Scrolling is now handled by the parent scroll container for parallax header effect
  overflowY: 'visible',
  color: vars.color.foreground,
  ':focus': {
    outline: 'none',
  },
});

export const editorPlaceholder = style({
  position: 'absolute',
  // Match the reduced top padding of editorInput
  top: vars.spacing['4'],
  left: vars.spacing['8'],
  color: vars.color.foregroundMuted,
  pointerEvents: 'none',
  fontSize: vars.typography.size.lg,
  fontStyle: 'italic',
});

export const editorParagraph = style({
  margin: 0,
  minHeight: '1.7em',
});

export const editorTextBold = style({
  fontWeight: vars.typography.weight.bold,
});

export const editorTextItalic = style({
  fontStyle: 'italic',
});

export const editorTextUnderline = style({
  textDecoration: 'underline',
});

// Loading and error states
export const editorLoading = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  fontSize: vars.typography.size.md,
  color: vars.color.foregroundMuted,
});

export const editorError = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  fontSize: vars.typography.size.md,
  color: vars.color.danger,
});

// List styles
export const listOl = style({
  margin: `0 0 ${vars.spacing['3']} 0`,
  paddingLeft: 0,
  listStylePosition: 'inside',
});

export const listUl = style({
  margin: `0 0 ${vars.spacing['3']} 0`,
  paddingLeft: 0,
  listStylePosition: 'inside',
});

export const listItem = style({
  margin: `${vars.spacing['2']} 0`,
  paddingLeft: 0,
});

export const nestedListItem = style({
  listStyleType: 'none',
  selectors: {
    '&:before': {
      display: 'none',
    },
  },
});

// Horizontal rule styles
export const hr = style({
  border: 'none',
  borderTop: `2px solid ${vars.color.border}`,
  margin: `${vars.spacing['6']} 0`,
  padding: 0,
  cursor: 'pointer',
});

export const hrSelected = style({
  borderTopColor: vars.color.accent,
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: '2px',
});

// Wiki link styles
export const wikiLink = style({
  color: vars.color.info,
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  padding: `0 ${vars.spacing['1']}`,
  margin: `0 1px`,
  textDecoration: 'none',
  ':hover': {
    textDecoration: 'underline',
    backgroundColor: `color-mix(in srgb, ${vars.color.info} 15%, transparent)`,
  },
});

// Unresolved wiki-link style (muted and italic)
export const wikiLinkUnresolved = style({
  color: vars.color.foregroundMuted,
  fontStyle: 'italic',
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  padding: `0 ${vars.spacing['1']}`,
  margin: `0 1px`,
  textDecoration: 'none',
  ':hover': {
    textDecoration: 'underline',
    backgroundColor: `color-mix(in srgb, ${vars.color.foregroundMuted} 15%, transparent)`,
  },
});

// === Global styles for Lexical-generated elements ===

// Headings
globalStyle(`${editorInput} h1`, {
  fontSize: '2.5rem',
  fontWeight: vars.typography.weight.bold,
  margin: `0 0 ${vars.spacing['6']} 0`,
  lineHeight: vars.typography.lineHeight.tight,
  color: vars.color.foreground,
});

globalStyle(`${editorInput} h2`, {
  fontSize: '2rem',
  fontWeight: vars.typography.weight.bold,
  margin: `${vars.spacing['8']} 0 ${vars.spacing['4']} 0`,
  lineHeight: '1.3',
  color: vars.color.foreground,
});

globalStyle(`${editorInput} h3`, {
  fontSize: '1.5rem',
  fontWeight: vars.typography.weight.bold,
  margin: `${vars.spacing['6']} 0 ${vars.spacing['3']} 0`,
  lineHeight: '1.4',
  color: vars.color.foreground,
});

// Code blocks
globalStyle(`${editorInput} code`, {
  backgroundColor: vars.color.surface,
  padding: `${vars.spacing['1']} ${vars.spacing['2']}`,
  borderRadius: vars.radius.sm,
  fontFamily: vars.typography.fontFamily.mono,
  fontSize: vars.typography.size.sm,
});

globalStyle(`${editorInput} pre`, {
  backgroundColor: vars.color.surface,
  padding: vars.spacing['4'],
  borderRadius: vars.radius.md,
  overflowX: 'auto',
  margin: `${vars.spacing['3']} 0`,
});

globalStyle(`${editorInput} pre code`, {
  backgroundColor: 'transparent',
  padding: 0,
});

// Blockquotes
globalStyle(`${editorInput} blockquote`, {
  borderLeft: `4px solid ${vars.color.border}`,
  paddingLeft: vars.spacing['4'],
  margin: `${vars.spacing['3']} 0`,
  fontStyle: 'italic',
  color: vars.color.foregroundMuted,
});

// Standard links (URLs) - use info color (blue) for clear link affordance
globalStyle(`${editorInput} a`, {
  color: vars.color.info,
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  borderRadius: vars.radius.sm,
  padding: `0 ${vars.spacing['1']}`,
});

globalStyle(`${editorInput} a:hover`, {
  backgroundColor: `color-mix(in srgb, ${vars.color.info} 15%, transparent)`,
});

// Selection styling
globalStyle(`${editorInput} ::selection`, {
  backgroundColor: `color-mix(in srgb, ${vars.color.accent} 30%, transparent)`,
});

// Nested list indentation
globalStyle(`${nestedListItem} > .${listOl}`, {
  paddingLeft: vars.spacing['6'],
});

globalStyle(`${nestedListItem} > .${listUl}`, {
  paddingLeft: vars.spacing['6'],
});

// Nested unordered list bullet styles
globalStyle(`${listUl} ${listUl}`, {
  listStyleType: 'circle',
});

globalStyle(`${listUl} ${listUl} ${listUl}`, {
  listStyleType: 'square',
});

// Wiki link styles - using globalStyle because WikiLinkNode uses hardcoded class name
// Resolved wiki-links use info color (blue) for clear link affordance
globalStyle(`${editorInput} .wiki-link`, {
  color: vars.color.info,
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  padding: `0 ${vars.spacing['1']}`,
  margin: '0 1px',
  textDecoration: 'none',
});

globalStyle(`${editorInput} .wiki-link:hover`, {
  textDecoration: 'underline',
  backgroundColor: `color-mix(in srgb, ${vars.color.info} 15%, transparent)`,
});

// Unresolved wiki-links use muted color and italic
globalStyle(`${editorInput} .wiki-link-unresolved`, {
  color: vars.color.foregroundMuted,
  fontStyle: 'italic',
  cursor: 'pointer',
  borderRadius: vars.radius.sm,
  padding: `0 ${vars.spacing['1']}`,
  margin: '0 1px',
  textDecoration: 'none',
});

globalStyle(`${editorInput} .wiki-link-unresolved:hover`, {
  textDecoration: 'underline',
  backgroundColor: `color-mix(in srgb, ${vars.color.foregroundMuted} 15%, transparent)`,
});

// Person mention styles - use info color (blue) for clear link affordance
globalStyle('.person-mention', {
  color: vars.color.info,
  cursor: 'pointer',
  fontStyle: 'normal',
  textDecoration: 'none',
  borderRadius: vars.radius.sm,
  padding: `0 ${vars.spacing['1']}`,
});

globalStyle('.person-mention:hover', {
  textDecoration: 'underline',
  backgroundColor: `color-mix(in srgb, ${vars.color.info} 15%, transparent)`,
});
