/**
 * Dual-layer markdown editor with contentEditable input and read-only overlay.
 * Implements selection tracking and synchronized scrolling.
 * Integrates with markdown parser worker for live token parsing.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { useMarkdownParser } from '../hooks/useMarkdownParser';
import { MarkdownOverlay } from './MarkdownOverlay';
import './Editor.css';

interface EditorProps {
  /** Initial content for the editor */
  initialContent?: string;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when selection changes, provides character offsets */
  onSelectionChange?: (start: number, end: number) => void;
}

export function Editor({ initialContent = '', onChange, onSelectionChange }: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const inputRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize markdown parser worker
  const { tokens, parse } = useMarkdownParser({ debounceMs: 100 });

  /**
   * Converts DOM selection to character offsets within the text content.
   * Returns [start, end] offsets, or null if no selection.
   */
  const getSelectionOffsets = useCallback((): [number, number] | null => {
    const selection = window.getSelection();
    if (!selection || !inputRef.current) return null;

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range) return null;

    // Create a range from start of input to start of selection
    const preRange = document.createRange();
    preRange.selectNodeContents(inputRef.current);
    preRange.setEnd(range.startContainer, range.startOffset);
    const start = preRange.toString().length;

    // End offset is start + selected text length
    const end = start + range.toString().length;

    return [start, end];
  }, []);

  /**
   * Handle input changes - extract plain text and update state
   */
  const handleInput = useCallback(() => {
    if (!inputRef.current) return;

    const text = inputRef.current.textContent || '';
    setContent(text);
    onChange?.(text);

    // Trigger debounced parse
    parse(text);
  }, [onChange, parse]);

  /**
   * Handle selection changes - track cursor/selection position
   */
  const handleSelectionChange = useCallback(() => {
    const offsets = getSelectionOffsets();
    if (offsets) {
      setSelectionStart(offsets[0]);
      setSelectionEnd(offsets[1]);
      onSelectionChange?.(offsets[0], offsets[1]);
    }
  }, [getSelectionOffsets, onSelectionChange]);

  /**
   * Sync scroll position between input layer and overlay
   */
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!overlayRef.current) return;
    overlayRef.current.scrollTop = e.currentTarget.scrollTop;
    overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  /**
   * Set up selection change listener
   */
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  /**
   * Initialize content in contentEditable div and parse initial content
   */
  useEffect(() => {
    if (inputRef.current && inputRef.current.textContent !== content) {
      inputRef.current.textContent = content;
    }

    // Parse initial content
    if (initialContent) {
      parse(initialContent);
    }
  }, [initialContent, parse]); // Only on mount

  return (
    <div className="editor-container" ref={containerRef}>
      {/* Read-only overlay layer - renders markdown with reveal-on-cursor */}
      <div className="editor-overlay" ref={overlayRef} aria-hidden="true">
        <div className="editor-overlay-content">
          <MarkdownOverlay
            tokens={tokens}
            selectionStart={selectionStart}
            selectionEnd={selectionEnd}
            fallbackText={content}
          />
        </div>
      </div>

      {/* Input layer - transparent contentEditable surface */}
      <div
        className="editor-input"
        ref={inputRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onScroll={handleScroll}
        spellCheck={false}
        role="textbox"
        aria-label="Markdown editor"
      />
    </div>
  );
}
