/**
 * Markdown overlay renderer with reveal-on-cursor behavior.
 * Hides markdown markers in non-active spans and reveals them around the cursor.
 */

import type { InlineToken } from '../workers/markdown-parser.worker';
import './MarkdownOverlay.css';

interface MarkdownOverlayProps {
  /** Parsed markdown tokens */
  tokens: InlineToken[];
  /** Current cursor/selection start position */
  selectionStart: number;
  /** Current cursor/selection end position */
  selectionEnd: number;
  /** Fallback plain text (shown when no tokens available) */
  fallbackText: string;
}

export function MarkdownOverlay({
  tokens,
  selectionStart,
  selectionEnd,
  fallbackText,
}: MarkdownOverlayProps) {
  // Debug logging
  console.log('MarkdownOverlay render:', {
    tokensCount: tokens.length,
    fallbackTextLength: fallbackText.length,
    fallbackTextJSON: JSON.stringify(fallbackText),
  });

  // Fallback to plain text if no tokens
  if (tokens.length === 0) {
    return <div className="markdown-overlay-fallback">{fallbackText}</div>;
  }

  return (
    <div className="markdown-overlay-tokens">
      {tokens.map((token, index) => (
        <TokenSpan
          key={`${token.start}-${token.end}-${index}`}
          token={token}
          isActive={isTokenActive(token, selectionStart, selectionEnd)}
        />
      ))}
    </div>
  );
}

/**
 * Determine if a token is "active" (cursor is within or adjacent to it).
 * Active tokens show raw markdown, inactive tokens hide markers.
 */
function isTokenActive(token: InlineToken, selStart: number, selEnd: number): boolean {
  // Token is active if selection overlaps with it
  // We add a small buffer (1 char) for better UX when cursor is at boundaries
  const buffer = 1;
  return (
    (selStart >= token.start - buffer && selStart <= token.end + buffer) ||
    (selEnd >= token.start - buffer && selEnd <= token.end + buffer) ||
    (selStart <= token.start && selEnd >= token.end)
  );
}

/**
 * Render a single token span with appropriate styling.
 */
function TokenSpan({ token, isActive }: { token: InlineToken; isActive: boolean }) {
  const className = `token token-${token.type} ${isActive ? 'token-active' : 'token-inactive'}`;

  // For active tokens, show raw markdown
  if (isActive) {
    return <span className={className}>{token.raw}</span>;
  }

  // For inactive tokens, hide markers and show formatted text
  switch (token.type) {
    case 'heading':
      return (
        <span className={className} data-level={token.level}>
          {token.text}
        </span>
      );

    case 'strong':
      return <strong className={className}>{token.text}</strong>;

    case 'emphasis':
      return <em className={className}>{token.text}</em>;

    case 'code':
      return <code className={className}>{token.text}</code>;

    case 'link':
      return (
        <span className={`${className} markdown-link`} data-link={token.text}>
          {token.text}
        </span>
      );

    case 'list-item':
      return (
        <span className={className} data-level={token.level}>
          {token.text}
        </span>
      );

    case 'newline':
      return <span className={className}>{'\n'}</span>;

    case 'text':
    default:
      return <span className={className}>{token.text}</span>;
  }
}
