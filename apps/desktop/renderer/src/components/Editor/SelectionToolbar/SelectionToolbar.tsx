/**
 * SelectionToolbar Component
 *
 * A floating toolbar that appears above selected text with formatting options.
 * Organized into two sections:
 * 1. Text formatting: Bold, Italic, Underline, Strikethrough
 * 2. Block formatting: H1, H2, Highlight
 *
 * TODO: Re-enable Actions section (Link, Ask AI) when implemented
 */

import { type MouseEvent } from 'react';
import clsx from 'clsx';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  Heading1Icon,
  Heading2Icon,
  HighlightIcon,
  // TODO: Re-enable when Link and Ask AI features are implemented
  // LinkIcon,
  // SparklesIcon,
} from '@scribe/design-system';
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
  // TODO: Re-enable when Ask AI feature is implemented
  // /** Callback when "Ask AI" is clicked */
  // onAskAi?: () => void;
}

export function SelectionToolbar({ position, activeFormats, onFormat }: SelectionToolbarProps) {
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
        icon={<BoldIcon size={16} strokeWidth={2.5} />}
        active={activeFormats.bold}
        onClick={() => onFormat('bold')}
        title="Bold"
      />
      <ToolbarButton
        icon={<ItalicIcon size={16} strokeWidth={2.5} />}
        active={activeFormats.italic}
        onClick={() => onFormat('italic')}
        title="Italic"
      />
      <ToolbarButton
        icon={<UnderlineIcon size={16} strokeWidth={2.5} />}
        active={activeFormats.underline}
        onClick={() => onFormat('underline')}
        title="Underline"
      />
      <ToolbarButton
        icon={<StrikethroughIcon size={16} strokeWidth={2.5} />}
        active={activeFormats.strikethrough}
        onClick={() => onFormat('strikethrough')}
        title="Strikethrough"
      />

      <div className={styles.divider} />

      {/* Block formatting section */}
      <ToolbarButton
        icon={<Heading1Icon size={16} strokeWidth={2.5} />}
        active={activeFormats.h1}
        onClick={() => onFormat('h1')}
        title="Heading 1"
      />
      <ToolbarButton
        icon={<Heading2Icon size={16} strokeWidth={2.5} />}
        active={activeFormats.h2}
        onClick={() => onFormat('h2')}
        title="Heading 2"
      />
      <ToolbarButton
        icon={<HighlightIcon size={16} strokeWidth={2.5} />}
        active={activeFormats.highlight}
        onClick={() => onFormat('highlight')}
        title="Highlight"
      />

      {/* TODO: Re-enable Actions section when Link and Ask AI features are implemented */}
      {/* <div className={styles.divider} /> */}
      {/* <ToolbarButton
        icon={<LinkIcon size={16} strokeWidth={2.5} />}
        active={activeFormats.link}
        onClick={() => onFormat('link')}
        title="Link"
      />
      <button className={styles.askAiButton} onClick={onAskAi} type="button" title="Ask AI">
        <SparklesIcon size={12} strokeWidth={2.5} />
        <span>Ask AI</span>
      </button> */}

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
