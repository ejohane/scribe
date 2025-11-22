/**
 * Web Worker for parsing markdown into inline token spans.
 * This worker processes markdown text and emits token spans with character offsets
 * for rendering in the editor overlay.
 */

export interface InlineToken {
  type: 'text' | 'emphasis' | 'strong' | 'code' | 'link' | 'heading' | 'list-item' | 'newline';
  start: number; // Character offset from start of document
  end: number; // Character offset (exclusive)
  raw: string; // Raw markdown text including markers
  text: string; // Display text (without markers)
  level?: number; // For headings (1-6) and lists
  markers?: {
    // Markdown markers to hide/reveal
    prefix?: string; // e.g., "**", "#", "*", "[[", "`"
    suffix?: string; // e.g., "**", "]]", "`"
  };
}

export interface ParseResult {
  tokens: InlineToken[];
  text: string; // Original text
}

export type WorkerMessage =
  | { type: 'parse'; text: string; id: number }
  | { type: 'cancel'; id: number };

export type WorkerResponse =
  | { type: 'result'; tokens: InlineToken[]; id: number }
  | { type: 'error'; error: string; id: number };

/**
 * Parse markdown text into inline tokens.
 * Uses a line-by-line approach with regex-based inline parsing.
 */
function parseMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const lines = text.split('\n');
  let offset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;

    // Check for heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const markers = headingMatch[1];
      const headingText = headingMatch[2];

      tokens.push({
        type: 'heading',
        start: lineStart,
        end: lineStart + line.length,
        raw: line,
        text: headingText,
        level: markers.length,
        markers: {
          prefix: markers + ' ',
        },
      });

      offset += line.length;

      // Add newline token if not the last line
      if (i < lines.length - 1) {
        tokens.push({
          type: 'newline',
          start: offset,
          end: offset + 1,
          raw: '\n',
          text: '\n',
        });
        offset += 1;
      }
      continue;
    }

    // Check for list item
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const indent = listMatch[1];
      const bullet = listMatch[2];
      const itemText = listMatch[3];

      tokens.push({
        type: 'list-item',
        start: lineStart,
        end: lineStart + line.length,
        raw: line,
        text: itemText,
        level: Math.floor(indent.length / 2), // 2 spaces = 1 level
        markers: {
          prefix: indent + bullet + ' ',
        },
      });

      offset += line.length;

      // Add newline token if not the last line
      if (i < lines.length - 1) {
        tokens.push({
          type: 'newline',
          start: offset,
          end: offset + 1,
          raw: '\n',
          text: '\n',
        });
        offset += 1;
      }
      continue;
    }

    // Parse inline tokens within the line
    const inlineTokens = parseInlineTokens(line, lineStart);
    tokens.push(...inlineTokens);

    offset += line.length;

    // Add newline token if not the last line
    if (i < lines.length - 1) {
      tokens.push({
        type: 'newline',
        start: offset,
        end: offset + 1,
        raw: '\n',
        text: '\n',
      });
      offset += 1;
    }
  }

  return tokens;
}

/**
 * Parse inline markdown tokens (emphasis, strong, code, links) within a line.
 */
function parseInlineTokens(line: string, lineStart: number): InlineToken[] {
  const tokens: InlineToken[] = [];
  let pos = 0;

  // Pattern priority: code, strong, emphasis, links
  // We'll use a simple state machine approach

  while (pos < line.length) {
    // Try to match inline code `...`
    if (line[pos] === '`') {
      const match = line.slice(pos).match(/^`([^`]+)`/);
      if (match) {
        tokens.push({
          type: 'code',
          start: lineStart + pos,
          end: lineStart + pos + match[0].length,
          raw: match[0],
          text: match[1],
          markers: {
            prefix: '`',
            suffix: '`',
          },
        });
        pos += match[0].length;
        continue;
      }
    }

    // Try to match bold **...**
    if (line.slice(pos, pos + 2) === '**') {
      const match = line.slice(pos).match(/^\*\*([^*]+)\*\*/);
      if (match) {
        tokens.push({
          type: 'strong',
          start: lineStart + pos,
          end: lineStart + pos + match[0].length,
          raw: match[0],
          text: match[1],
          markers: {
            prefix: '**',
            suffix: '**',
          },
        });
        pos += match[0].length;
        continue;
      }
    }

    // Try to match italic *...*
    if (line[pos] === '*' && line[pos + 1] !== '*') {
      const match = line.slice(pos).match(/^\*([^*]+)\*/);
      if (match) {
        tokens.push({
          type: 'emphasis',
          start: lineStart + pos,
          end: lineStart + pos + match[0].length,
          raw: match[0],
          text: match[1],
          markers: {
            prefix: '*',
            suffix: '*',
          },
        });
        pos += match[0].length;
        continue;
      }
    }

    // Try to match links [[...]]
    if (line.slice(pos, pos + 2) === '[[') {
      const match = line.slice(pos).match(/^\[\[([^\]]+)\]\]/);
      if (match) {
        tokens.push({
          type: 'link',
          start: lineStart + pos,
          end: lineStart + pos + match[0].length,
          raw: match[0],
          text: match[1],
          markers: {
            prefix: '[[',
            suffix: ']]',
          },
        });
        pos += match[0].length;
        continue;
      }
    }

    // If we reach here, this is plain text - skip to next special char
    const nextSpecialPos = findNextSpecial(line, pos);
    const textEnd = nextSpecialPos === -1 ? line.length : nextSpecialPos;

    if (textEnd > pos) {
      tokens.push({
        type: 'text',
        start: lineStart + pos,
        end: lineStart + textEnd,
        raw: line.slice(pos, textEnd),
        text: line.slice(pos, textEnd),
      });
      pos = textEnd;
    } else {
      // Shouldn't happen, but prevent infinite loop
      pos++;
    }
  }

  return tokens;
}

/**
 * Find the next position of a special markdown character.
 */
function findNextSpecial(line: string, start: number): number {
  const specials = ['*', '`', '['];
  let minPos = -1;

  for (const char of specials) {
    const pos = line.indexOf(char, start);
    if (pos !== -1 && (minPos === -1 || pos < minPos)) {
      minPos = pos;
    }
  }

  return minPos;
}

// Worker message handler
let currentParseId = -1;

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;

  if (message.type === 'cancel') {
    // Cancel current parsing if it matches
    if (currentParseId === message.id) {
      currentParseId = -1;
    }
    return;
  }

  if (message.type === 'parse') {
    currentParseId = message.id;

    try {
      // Check if we've been cancelled
      if (currentParseId !== message.id) {
        return;
      }

      const tokens = parseMarkdown(message.text);

      // Check again before sending result
      if (currentParseId !== message.id) {
        return;
      }

      const response: WorkerResponse = {
        type: 'result',
        tokens,
        id: message.id,
      };

      self.postMessage(response);
    } catch (error) {
      const response: WorkerResponse = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        id: message.id,
      };

      self.postMessage(response);
    }
  }
};
