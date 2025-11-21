# React Hooks

## useMarkdownParser

Manages the markdown parser worker with debounced parsing.

### Features

- Automatic worker lifecycle management
- Debounced parsing (default 100ms)
- Parse cancellation for superseded requests
- Error handling

### Usage

```typescript
const { tokens, parse, isParsing } = useMarkdownParser({
  debounceMs: 150, // Optional
});

// Trigger parse
parse(markdownText);
```

See `workers/README.md` for token structure.

## useNoteEditor

Manages note loading and autosaving with the Core Engine.

### Features

- Automatic note loading when noteId changes
- Debounced autosave (default 1000ms)
- Save on blur (window loses focus)
- Save on unmount (prevents data loss)
- Non-blocking error handling
- Immediate save support

### Usage

```typescript
const { content, isLoading, isSaving, loadError, saveError, updateContent, saveNow } =
  useNoteEditor({
    coreClient,
    noteId: 'note:my-note',
    autosaveDelay: 1000, // Optional
    onSaveSuccess: () => console.log('Saved!'),
    onSaveError: (err) => console.error('Save failed:', err),
  });

// Update content (triggers autosave)
updateContent(newMarkdown);

// Save immediately
await saveNow();
```

### Autosave Behavior

**Debounced autosave:**

- Waits 1 second (configurable) after last edit
- Prevents save spam during rapid typing
- Cancels pending saves when new changes occur

**Save on blur:**

- Automatically saves when window loses focus
- Ensures changes aren't lost when switching apps
- Clears pending debounced save

**Save on unmount:**

- Fires when component unmounts
- Last-resort data safety mechanism
- Fire-and-forget (doesn't block unmount)

### Error Handling

Errors are surfaced via:

- `loadError` - Failed to load note
- `saveError` - Failed to save note
- Callbacks: `onSaveSuccess`, `onSaveError`

Saves are non-blocking - the UI remains responsive even if saves fail.

### State Management

The hook maintains:

- Current content (local state)
- Pending content (for autosave)
- Loading/saving states
- Error states

Content updates are optimistic - the UI updates immediately while saves happen in the background.

### Performance

- Debouncing prevents excessive RPC calls
- Worker-based parsing keeps UI responsive
- Autosave fires in background (non-blocking)
- Minimal re-renders via careful state management
