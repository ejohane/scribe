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

export const editorTextStrikethrough = style({
  textDecoration: 'line-through',
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

// Checklist item styles - base styling for both checked and unchecked
const checklistItemBase = {
  position: 'relative' as const,
  marginLeft: '0.5em',
  marginRight: '0.5em',
  paddingLeft: '1.5em',
  paddingRight: '1.5em',
  listStyleType: 'none' as const,
  outline: 'none',
  display: 'block' as const,
  minHeight: '1.5em',
  ':focus': {
    outline: 'none',
  },
  ':focus-visible': {
    outline: 'none',
  },
};

export const listItemUnchecked = style({
  ...checklistItemBase,
  selectors: {
    '&:before': {
      content: '""',
      width: '0.9em',
      height: '0.9em',
      top: '50%',
      left: '0',
      cursor: 'pointer',
      display: 'block',
      backgroundSize: 'cover',
      position: 'absolute',
      transform: 'translateY(-50%)',
      border: `1px solid ${vars.color.foregroundMuted}`,
      borderRadius: vars.radius.sm,
    },
    '&:focus:before': {
      boxShadow: `0 0 0 2px ${vars.color.accent}`,
    },
  },
});

export const listItemChecked = style({
  ...checklistItemBase,
  textDecoration: 'line-through',
  color: vars.color.foregroundMuted,
  selectors: {
    '&:before': {
      content: '""',
      width: '0.9em',
      height: '0.9em',
      top: '50%',
      left: '0',
      cursor: 'pointer',
      display: 'block',
      backgroundSize: 'cover',
      position: 'absolute',
      transform: 'translateY(-50%)',
      border: `1px solid ${vars.color.accent}`,
      borderRadius: vars.radius.sm,
      backgroundColor: vars.color.accent,
    },
    '&:after': {
      content: '""',
      cursor: 'pointer',
      borderColor: '#fff',
      borderStyle: 'solid',
      position: 'absolute',
      display: 'block',
      top: '45%',
      width: '0.2em',
      left: '0.35em',
      height: '0.4em',
      transform: 'translateY(-50%) rotate(45deg)',
      borderWidth: '0 0.1em 0.1em 0',
    },
    '&:focus:before': {
      boxShadow: `0 0 0 2px ${vars.color.accent}`,
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
  cursor: 'pointer',
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

// === Table styles ===

// Horizontal scroll container for wide tables
export const tableScrollContainer = style({
  overflowX: 'auto',
  margin: `${vars.spacing['4']} 0`,
  maxWidth: '100%',
});

// Base table style
export const table = style({
  borderCollapse: 'collapse',
  width: '100%',
  margin: `${vars.spacing['4']} 0`,
  tableLayout: 'auto',
});

// Table row
export const tableRow = style({});

// Table cell (td)
export const tableCell = style({
  border: `1px solid ${vars.color.border}`,
  padding: vars.spacing['2'],
  minWidth: '80px',
  verticalAlign: 'top',
  textAlign: 'left',
});

// Table header cell (th)
export const tableCellHeader = style({
  border: `1px solid ${vars.color.border}`,
  borderBottomWidth: '2px',
  padding: vars.spacing['2'],
  minWidth: '80px',
  verticalAlign: 'top',
  textAlign: 'left',
  fontWeight: vars.typography.weight.bold,
  backgroundColor: vars.color.surface,
});

// Selected table state (multi-cell selection active)
export const tableSelection = style({
  outline: `2px solid ${vars.color.info}`,
  outlineOffset: '2px',
});

// Selected cell state
export const tableCellSelected = style({
  backgroundColor: `color-mix(in srgb, ${vars.color.info} 15%, transparent)`,
});

// === Search highlight styles ===

// Base search highlight (all matches) - yellow highlighter effect
globalStyle(`${editorInput} mark[data-lexical-mark-ids*="search-match"]`, {
  backgroundColor: 'rgba(255, 212, 0, 0.4)',
  borderRadius: vars.radius.sm,
  padding: '0 1px',
});

// Active/current match - orange with accent outline for emphasis
globalStyle(`${editorInput} mark[data-lexical-mark-ids*="search-match-active"]`, {
  backgroundColor: 'rgba(255, 165, 0, 0.6)',
  outline: `2px solid ${vars.color.accent}`,
  outlineOffset: '1px',
});

// === Collapsible Heading styles ===

// Fold icon - positioned via JS portal, hidden by default
export const foldIcon = style({
  position: 'fixed',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  opacity: 0,
  transition: 'opacity 150ms ease',
  color: vars.color.foregroundMuted,
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontSize: '12px',
  zIndex: 10,
  ':hover': {
    color: vars.color.foreground,
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
  // Touch device support: always visible
  '@media': {
    '(hover: none) and (pointer: coarse)': {
      opacity: 1,
      width: '44px',
      height: '44px',
    },
  },
});

// Class to show fold icon (applied on heading hover)
export const foldIconVisible = style({
  opacity: 1,
});

// Visual indicator on collapsed headings - "..." suffix
globalStyle('.collapsible-heading[data-collapsed="true"]::after', {
  content: '"..."',
  color: vars.color.foregroundMuted,
  marginLeft: vars.spacing['2'],
  fontSize: '0.8em',
});

// Content hidden under collapsed headings
globalStyle('.collapsed-content', {
  display: 'none',
});

// Base styling for collapsible headings - position relative for potential fold icon positioning
globalStyle('.collapsible-heading', {
  position: 'relative',
});

// === Markdown Reveal styles ===
// These styles are used by MarkdownRevealNode to visually distinguish
// revealed markdown syntax, making delimiters appear muted while keeping content readable.

/**
 * Container for the entire revealed markdown.
 * Ensures inline display to flow with surrounding text.
 */
export const markdownReveal = style({
  display: 'inline',
});

/**
 * Styles for markdown delimiter characters (**, *, ~~, `, etc.).
 * Uses muted opacity to create visual distinction from content.
 * The delimiter is visible but de-emphasized, showing "these are syntax markers."
 */
export const markdownDelimiter = style({
  opacity: 0.5,
  transition: 'opacity 100ms ease-in-out',
});

/**
 * Styles for the actual text content between delimiters.
 * Inherits normal text styling - content should look the same as regular text.
 */
export const markdownContent = style({
  // Inherits normal text styling
});

// Global styles for markdown reveal - using globalStyle because MarkdownRevealNode uses hardcoded class names
// Container style for the reveal node
globalStyle(`${editorInput} .markdown-reveal`, {
  display: 'inline',
});

// Content wrapper style - the entire revealed markdown string
globalStyle(`${editorInput} .markdown-reveal-content`, {
  display: 'inline',
});

// Delimiter style - applied to syntax characters when parsed
globalStyle(`${editorInput} .markdown-reveal-delimiter`, {
  opacity: 0.5,
  color: vars.color.foregroundMuted,
  transition: 'opacity 100ms ease-in-out',
});

// Text content style - inherits normal text styling
globalStyle(`${editorInput} .markdown-reveal-text`, {
  // Inherits normal text styling - no special styles needed
});

// Inline code reveal styles - monospace font for code content
// When a markdown-reveal node has data-format-code="true", apply monospace to the content
globalStyle(`${editorInput} .markdown-reveal[data-format-code="true"] .markdown-reveal-text`, {
  fontFamily: vars.typography.fontFamily.mono,
  fontSize: vars.typography.size.sm,
});

// Also style the delimiters (backticks) for code - keep them slightly smaller to not be too prominent
globalStyle(`${editorInput} .markdown-reveal[data-format-code="true"] .markdown-reveal-delimiter`, {
  fontFamily: vars.typography.fontFamily.mono,
  fontSize: vars.typography.size.sm,
});

// Strikethrough reveal styles - preserve line-through on content when revealed
// When a markdown-reveal node has data-format-strikethrough="true", apply strikethrough to the content
// The delimiters (~~) appear muted but the text content keeps its strikethrough styling
globalStyle(
  `${editorInput} .markdown-reveal[data-format-strikethrough="true"] .markdown-reveal-text`,
  {
    textDecoration: 'line-through',
  }
);

// === Heading Reveal styles ===
// These styles are used for the heading prefix reveal feature.
// When cursor is on a heading line, the markdown prefix (e.g., "## ") is shown.

/**
 * Heading reveal prefix - shown at the start of the heading when focused.
 * Styled muted to indicate it's syntax, not content.
 */
globalStyle(`${editorInput} .heading-reveal-prefix`, {
  opacity: 0.5,
  color: vars.color.foregroundMuted,
  fontWeight: 'normal',
  transition: 'opacity 100ms ease-in-out',
  // Don't inherit heading font size for the prefix - keep it proportional
  // but not as large as the actual heading text
  fontSize: '0.7em',
  // Use monospace font for the hash marks to look more like markdown
  fontFamily: vars.typography.fontFamily.mono,
  // Add small margin to separate from heading text
  marginRight: vars.spacing['1'],
  // Make it non-selectable to prevent accidental selection
  userSelect: 'none',
});

// === Blockquote Reveal styles ===
// These styles are used for the blockquote prefix reveal feature.
// When cursor is in a blockquote, the markdown prefix (e.g., "> ") is shown.

/**
 * Blockquote reveal prefix - shown at the start of the blockquote when focused.
 * Styled muted to indicate it's syntax, not content.
 * Similar styling to heading prefix but without font size reduction.
 */
globalStyle(`${editorInput} .blockquote-reveal-prefix`, {
  opacity: 0.5,
  color: vars.color.foregroundMuted,
  fontStyle: 'normal', // Override blockquote's italic style for the prefix
  fontWeight: 'normal',
  transition: 'opacity 100ms ease-in-out',
  // Use monospace font for the > character to look more like markdown
  fontFamily: vars.typography.fontFamily.mono,
  // Add small margin to separate from blockquote text
  marginRight: vars.spacing['1'],
  // Make it non-selectable to prevent accidental selection
  userSelect: 'none',
});
