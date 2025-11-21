# Web Workers

## markdown-parser.worker.ts

A web worker that parses markdown text into inline token spans for rendering in the editor overlay.

### Purpose

The parser worker runs markdown parsing in a separate thread to avoid blocking the main UI thread during typing. It emits a stream of tokens with character offsets that can be used for:

1. **Reveal-on-cursor rendering** (scribe-751) - Show/hide markdown markers based on cursor position
2. **Syntax highlighting** - Apply different styles to different token types
3. **Interactive elements** - Make links clickable, code blocks copyable, etc.

### Token Types

The worker emits the following token types:

- `text` - Plain text without markdown formatting
- `emphasis` - Italic text (`*text*`)
- `strong` - Bold text (`**text**`)
- `code` - Inline code (`` `code` ``)
- `link` - Wiki-style links (`[[link]]`)
- `heading` - Headings (`# Heading`)
- `list-item` - List items (`- item`, `1. item`)

### Token Structure

Each token includes:

```typescript
{
  type: 'text' | 'emphasis' | 'strong' | 'code' | 'link' | 'heading' | 'list-item',
  start: number,    // Character offset from start
  end: number,      // Character offset (exclusive)
  raw: string,      // Raw markdown including markers
  text: string,     // Display text without markers
  level?: number,   // For headings (1-6) and lists
  markers?: {       // Markdown markers to hide/reveal
    prefix?: string,
    suffix?: string
  }
}
```

### Debouncing

The `useMarkdownParser` hook provides automatic debouncing (default 100ms) to:

- Reduce parsing overhead during fast typing
- Prevent worker message queue buildup
- Maintain smooth editor performance

### Usage

```typescript
import { useMarkdownParser } from '../hooks/useMarkdownParser';

function MyEditor() {
  const { tokens, parse, isParsing } = useMarkdownParser({
    debounceMs: 150, // Optional, default 100ms
  });

  const handleInput = (text: string) => {
    parse(text); // Debounced parsing
  };

  // Use tokens for rendering...
}
```

### Performance Considerations

- Parsing runs in a separate thread (non-blocking)
- Debouncing prevents excessive parsing
- Parse requests can be cancelled if superseded
- Token offsets enable efficient rendering updates

### Limitations

Current implementation uses regex-based parsing which:

- ✅ Fast and lightweight
- ✅ Handles common markdown syntax
- ❌ Doesn't handle nested formatting (e.g., `**bold *and italic***`)
- ❌ Doesn't parse code blocks (only inline code)
- ❌ Limited to inline tokens (no block-level parsing)

These limitations are acceptable for the minimal editor phase. Future enhancements could use a full markdown AST parser if needed.

### Next Steps

- **scribe-751**: Use tokens for reveal-on-cursor rendering
- **scribe-753**: Integrate with command palette for quick navigation
- Future: Add syntax highlighting based on token types
