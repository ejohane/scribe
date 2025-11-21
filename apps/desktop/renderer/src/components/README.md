# Editor Component

## Architecture: Dual-Layer Design

The Editor component implements a dual-layer architecture for markdown editing:

### Layer 1: Input Surface (`.editor-input`)

- `contentEditable` div that captures all typing
- Transparent text (`color: transparent`)
- Visible caret (`caret-color: #000000`)
- Handles all user input and selection

### Layer 2: Overlay Surface (`.editor-overlay`)

- Read-only div positioned above the input layer
- Displays rendered markdown (currently mirrors text, will be enhanced in scribe-750, scribe-751)
- Non-interactive (`pointer-events: none`)
- Synced scroll with input layer

## Key Features

### Selection Tracking

- Converts DOM selection to character offsets
- `getSelectionOffsets()` returns `[start, end]` positions
- Fires `onSelectionChange` callback for cursor/selection changes
- Required for reveal-on-cursor rendering (scribe-751)

### Synchronized Scrolling

- `handleScroll` keeps both layers aligned
- Prevents visual desync during scrolling
- Critical for maintaining overlay/input alignment

### Content Management

- Extracts plain text from contentEditable
- Normalizes content to `textContent`
- Fires `onChange` callback on every input event

## Typography Alignment

Both layers must have **identical** typography settings:

- `font-family`
- `font-size`
- `line-height`
- `padding`
- `white-space`
- `word-wrap`

Any mismatch causes rendering offset issues.

## Parser Integration (scribe-750) ✅

The editor now integrates with a web worker for markdown parsing:

### Parser Worker

- Runs in separate thread (non-blocking)
- Emits inline token spans with character offsets
- Debounced parsing (100ms default) for performance
- Supports: headings, bold, italic, code, links, lists

### Token Stream

Tokens include:

- Character offsets (`start`, `end`)
- Raw markdown with markers
- Display text without markers
- Marker positions for reveal-on-cursor

See `workers/README.md` for detailed documentation.

## Next Steps

- **scribe-751**: Overlay will render markdown with reveal-on-cursor using tokens
- **scribe-752**: Load/save integration with CoreClient
- **scribe-753**: Command palette integration

## Usage

```tsx
import { Editor } from './components/Editor';

function App() {
  const handleChange = (content: string) => {
    console.log('Content:', content);
  };

  const handleSelectionChange = (start: number, end: number) => {
    console.log('Selection:', start, end);
  };

  return (
    <Editor
      initialContent="# Hello World"
      onChange={handleChange}
      onSelectionChange={handleSelectionChange}
    />
  );
}
```
