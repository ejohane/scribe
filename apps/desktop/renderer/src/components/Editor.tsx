/**
 * Dual-layer markdown editor with textarea input and read-only overlay.
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize markdown parser worker
  const { tokens, parse } = useMarkdownParser({ debounceMs: 100 });

  /**
   * Handle input changes from textarea
   */
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setContent(text);
      onChange?.(text);

      // Track selection
      setSelectionStart(e.target.selectionStart);
      setSelectionEnd(e.target.selectionEnd);
      onSelectionChange?.(e.target.selectionStart, e.target.selectionEnd);

      // Trigger debounced parse
      parse(text);
    },
    [onChange, onSelectionChange, parse]
  );

  /**
   * Handle selection changes - track cursor/selection position
   */
  const handleSelect = useCallback(() => {
    if (!inputRef.current) return;
    const start = inputRef.current.selectionStart;
    const end = inputRef.current.selectionEnd;
    setSelectionStart(start);
    setSelectionEnd(end);
    onSelectionChange?.(start, end);
  }, [onSelectionChange]);

  /**
   * Sync scroll position between input layer and overlay
   */
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!overlayRef.current) return;
    overlayRef.current.scrollTop = e.currentTarget.scrollTop;
    overlayRef.current.scrollLeft = e.currentTarget.scrollLeft;
  }, []);

  /**
   * Initialize content in contentEditable div on mount
   */
  useEffect(() => {
    if (inputRef.current) {
      if (initialContent) {
        inputRef.current.textContent = initialContent;
        parse(initialContent);
      }
      // Focus the editor and show cursor
      inputRef.current.focus();
    }
  }, []); // Only run on mount

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

      {/* Input layer - transparent textarea */}
      <textarea
        className="editor-input"
        ref={inputRef}
        value={content}
        onChange={handleInput}
        onSelect={handleSelect}
        onScroll={handleScroll}
        spellCheck={false}
        aria-label="Markdown editor"
      />
    </div>
  );
}
