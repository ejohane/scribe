/**
 * SelectionToolbar Component
 *
 * A floating toolbar that appears above selected text with formatting options.
 * Organized into three sections:
 * 1. Text formatting: Bold, Italic, Underline, Strikethrough
 * 2. Block formatting: H1, H2, Highlight
 * 3. Actions: Link, "Ask AI" (placeholder)
 */

import { type MouseEvent } from 'react';
import clsx from 'clsx';
import * as styles from './SelectionToolbar.css';

export type FormatType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'highlight'
  | 'link';

interface Position {
  top: number;
  left: number;
}

interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  h1: boolean;
  h2: boolean;
  highlight: boolean;
  link: boolean;
}

export interface SelectionToolbarProps {
  /** Position of the toolbar (null means hidden) */
  position: Position | null;
  /** Currently active formats */
  activeFormats: ActiveFormats;
  /** Callback when a format button is clicked */
  onFormat: (format: FormatType) => void;
  /** Callback when "Ask AI" is clicked */
  onAskAi?: () => void;
}

export function SelectionToolbar({
  position,
  activeFormats,
  onFormat,
  onAskAi,
}: SelectionToolbarProps) {
  if (!position) return null;

  // Prevent losing text selection when clicking toolbar buttons
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      className={styles.toolbar}
      style={{ top: position.top, left: position.left }}
      onMouseDown={handleMouseDown}
      role="toolbar"
      aria-label="Text formatting"
    >
      {/* Text formatting section */}
      <ToolbarButton
        icon={<BoldIcon />}
        active={activeFormats.bold}
        onClick={() => onFormat('bold')}
        title="Bold"
      />
      <ToolbarButton
        icon={<ItalicIcon />}
        active={activeFormats.italic}
        onClick={() => onFormat('italic')}
        title="Italic"
      />
      <ToolbarButton
        icon={<UnderlineIcon />}
        active={activeFormats.underline}
        onClick={() => onFormat('underline')}
        title="Underline"
      />
      <ToolbarButton
        icon={<StrikethroughIcon />}
        active={activeFormats.strikethrough}
        onClick={() => onFormat('strikethrough')}
        title="Strikethrough"
      />

      <div className={styles.divider} />

      {/* Block formatting section */}
      <ToolbarButton
        icon={<Heading1Icon />}
        active={activeFormats.h1}
        onClick={() => onFormat('h1')}
        title="Heading 1"
      />
      <ToolbarButton
        icon={<Heading2Icon />}
        active={activeFormats.h2}
        onClick={() => onFormat('h2')}
        title="Heading 2"
      />
      <ToolbarButton
        icon={<HighlightIcon />}
        active={activeFormats.highlight}
        onClick={() => onFormat('highlight')}
        title="Highlight"
      />

      <div className={styles.divider} />

      {/* Actions section */}
      <ToolbarButton
        icon={<LinkIcon />}
        active={activeFormats.link}
        onClick={() => onFormat('link')}
        title="Link"
      />
      <button className={styles.askAiButton} onClick={onAskAi} type="button" title="Ask AI">
        <SparklesIcon size={12} />
        <span>Ask AI</span>
      </button>

      {/* Triangle pointer */}
      <div className={styles.pointerBorder} />
      <div className={styles.pointer} />
    </div>
  );
}

// ============================================================================
// Toolbar Button
// ============================================================================

interface ToolbarButtonProps {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}

function ToolbarButton({ icon, active, onClick, title }: ToolbarButtonProps) {
  return (
    <button
      className={clsx(styles.button, active && styles.buttonActive)}
      onClick={onClick}
      type="button"
      title={title}
    >
      {icon}
    </button>
  );
}

// ============================================================================
// Icons (inline SVG to avoid external dependencies)
// ============================================================================

function BoldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  );
}

function StrikethroughIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4H9a3 3 0 0 0-2.83 4" />
      <path d="M14 12a4 4 0 0 1 0 8H6" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}

function Heading1Icon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="m17 12 3-2v8" />
    </svg>
  );
}

function Heading2Icon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12h8" />
      <path d="M4 18V6" />
      <path d="M12 18V6" />
      <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function SparklesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
