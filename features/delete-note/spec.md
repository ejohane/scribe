# Feature: Delete Note Command

**Status**: Draft  
**Created**: 2024-11-25

## Overview

Add a "Delete Note" command that allows users to permanently delete notes from the vault. The command uses the existing file-browse mode for note selection, with an added confirmation modal to prevent accidental deletions.

---

## Entry Points

| Trigger                            | Behavior                                |
| ---------------------------------- | --------------------------------------- |
| `Cmd+K` -> select "Delete Note"    | Enters `delete-browse` mode             |
| Click delete icon in `file-browse` | Opens confirmation screen for that note |

---

## User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Delete Note Flow                               │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  User Input  │
    │  Cmd+K ->    │
    │  Delete Note │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────┐
    │  delete-browse   │
    │  mode (file      │
    │  selection)      │
    └──────┬───────────┘
           │
           ├─────────────────────────────────────────┐
           │                                         │
           ▼                                         ▼
    ┌──────────────┐                          ┌─────────────┐
    │ User selects │                          │ User presses│
    │ a note       │                          │ Escape      │
    └──────┬───────┘                          └──────┬──────┘
           │                                         │
           ▼                                         ▼
    ┌──────────────────┐                      ┌─────────────────┐
    │ Confirmation     │                      │ Return to       │
    │ screen (replaces │                      │ command mode    │
    │ palette content) │                      └─────────────────┘
    └──────┬───────────┘
           │
           ├────────────────────┬────────────────────┐
           │                    │                    │
           ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ Confirm     │      │ Cancel      │      │ Close       │
    │ deletion    │      │ (button)    │      │ palette     │
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │ Delete note,│      │ Return to   │      │ Close       │
    │ open most   │      │ delete-     │      │ palette     │
    │ recent note │      │ browse mode │      │             │
    └─────────────┘      └─────────────┘      └─────────────┘
```

---

## Delete Icon in File-Browse Mode

In `file-browse` mode (Open Note), each note item displays a delete icon on hover, providing quick access to deletion without switching modes.

### UI Layout

```
┌─────────────────────────────────────────┐
│ <- │ Search notes...                    │
├─────────────────────────────────────────┤
│ Meeting Notes                           │  <- Not hovered (no icon)
│ 2 hours ago                             │
├─────────────────────────────────────────┤
│ Project Ideas                       [x] │  <- Hovered (delete icon visible)
│ Yesterday                               │
├─────────────────────────────────────────┤
│ My very long note title that keeps g... │
│ Nov 24, 2025                            │
└─────────────────────────────────────────┘
```

### Delete Icon Behavior

| State                    | Icon Visibility |
| ------------------------ | --------------- |
| Item not hovered         | Hidden          |
| Item hovered             | Visible         |
| Item selected (keyboard) | Hidden          |

### Icon Specifications

| Element        | Specification                                        |
| -------------- | ---------------------------------------------------- |
| **Icon**       | Trash/delete icon (e.g., `x` or trash can)           |
| **Position**   | Right side of list item, vertically centered         |
| **Size**       | 16x16px                                              |
| **Color**      | Muted gray (`#999`), red on hover (`#dc3545`)        |
| **Hover area** | Slightly larger than icon for easier clicking (24px) |
| **Cursor**     | Pointer on hover                                     |

### Click Behavior

| Action            | Result                                                        |
| ----------------- | ------------------------------------------------------------- |
| Click delete icon | Opens confirmation screen (same as `delete-browse` selection) |
| Click note item   | Opens note (existing behavior unchanged)                      |

### Interaction Details

- Clicking the delete icon should **not** trigger the note open action
- Icon click opens confirmation screen; after cancel, returns to `file-browse` mode (not `delete-browse`)
- The delete icon should have `stopPropagation` to prevent triggering the parent click handler

---

## Delete Browse Mode Behavior

Identical to `file-browse` mode (see [open-file-command.md](../open-file-command.md)) with these differences:

| Element               | Specification                                    |
| --------------------- | ------------------------------------------------ |
| **Input placeholder** | "Select note to delete..."                       |
| **Mode identifier**   | `delete-browse`                                  |
| **On note selection** | Opens confirmation modal instead of opening note |

### Note List Display

| State              | Display                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| Initial (no query) | 10 most recent notes by `updatedAt` (excluding current note)                   |
| Typing             | Fuzzy search results by Fuse.js score, max 25 results (excluding current note) |
| Query cleared      | Recent files reappear                                                          |
| No results         | "No results"                                                                   |
| Empty vault        | "No notes to delete"                                                           |
| Loading            | "Loading..." text                                                              |

---

## Confirmation Screen

When a note is selected for deletion, the command palette content is replaced with a confirmation screen.

### UI Layout

```
┌─────────────────────────────────────────┐
│                                         │
│       Delete "Meeting Notes"?           │
│                                         │
│       This action cannot be undone.     │
│                                         │
│        [ Cancel ]    [ Delete ]         │
│                                         │
└─────────────────────────────────────────┘
```

### Screen Elements

| Element           | Specification                                                                |
| ----------------- | ---------------------------------------------------------------------------- |
| **Title**         | `Delete "{note-title}"?` (truncate title at ~30 chars)                       |
| **Body text**     | "This action cannot be undone."                                              |
| **Cancel button** | Secondary style, returns to previous mode (`delete-browse` or `file-browse`) |
| **Delete button** | Destructive/danger style (red), confirms deletion                            |
| **Animation**     | Fade in (0.15s ease-out)                                                     |

### Confirmation Screen Keyboard Shortcuts

| Shortcut | Action                                                             |
| -------- | ------------------------------------------------------------------ |
| `Escape` | Cancel, return to previous mode (`delete-browse` or `file-browse`) |
| `Enter`  | Confirm deletion                                                   |
| `Tab`    | Move focus between Cancel and Delete                               |

---

## Keyboard Shortcuts

### In `delete-browse` Mode

| Shortcut  | Action                                           |
| --------- | ------------------------------------------------ |
| `Escape`  | Return to `command` mode                         |
| `Enter`   | Select highlighted note, open confirmation modal |
| `Up/Down` | Navigate list                                    |

### In Confirmation Screen

| Shortcut | Action                                 |
| -------- | -------------------------------------- |
| `Escape` | Cancel, return to `delete-browse` mode |
| `Enter`  | Confirm deletion, close palette        |

---

## Click Behavior

### In `delete-browse` Mode

| Action                   | Result                                  |
| ------------------------ | --------------------------------------- |
| Click back button (`<-`) | Return to `command` mode                |
| Click outside palette    | Close palette entirely, create new note |
| Click note item          | Open confirmation modal for that note   |

### In Confirmation Screen

| Action              | Result                         |
| ------------------- | ------------------------------ |
| Click Cancel button | Return to `delete-browse` mode |
| Click Delete button | Delete note, close palette     |
| Click backdrop      | Close palette entirely         |

---

## Post-Deletion Behavior

| Scenario                          | Behavior                                       |
| --------------------------------- | ---------------------------------------------- |
| Deleted note was current note     | Open most recent remaining note                |
| Deleted note was not current note | Keep current note loaded                       |
| No notes remaining after deletion | Create new note                                |
| Command palette state             | Close palette after successful deletion        |
| Success toast                     | Show success toast: `"{note-title}" deleted`   |
| Error during deletion             | Show error toast, stay in `delete-browse` mode |

---

## Toast Notifications

Display toast notifications to provide feedback after delete actions.

### Success Toast

Displayed after a note is successfully deleted.

```
┌─────────────────────────────────────────┐
│  "Meeting Notes" deleted                │
└─────────────────────────────────────────┘
```

### Error Toast

Displayed when deletion fails.

```
┌─────────────────────────────────────────┐
│  Failed to delete note                  │
└─────────────────────────────────────────┘
```

### Toast Specifications

| Element            | Specification                                     |
| ------------------ | ------------------------------------------------- |
| **Position**       | Bottom-center of viewport                         |
| **Width**          | Auto (content-based), max 400px                   |
| **Duration**       | 3 seconds, then auto-dismiss                      |
| **Animation**      | Slide up + fade in, slide down + fade out         |
| **Success style**  | Neutral background (matches app theme)            |
| **Error style**    | Red/destructive background or red text            |
| **Title truncate** | Truncate note title at ~30 chars with ellipsis    |
| **Dismissible**    | Click to dismiss early (optional)                 |
| **Stacking**       | If multiple toasts, stack vertically with 8px gap |

---

## Edge Cases

| Case                    | Behavior                                                |
| ----------------------- | ------------------------------------------------------- |
| Delete current note     | After deletion, open most recent remaining note         |
| Last note in vault      | After deletion, silently create new note                |
| Very long note title    | Truncate with ellipsis in modal (~30 chars)             |
| Deletion fails          | Show error notification, return to `delete-browse` mode |
| Note deleted externally | Handle gracefully if note doesn't exist during delete   |

---

## Command Registration

```typescript
commandRegistry.register({
  id: 'delete-note',
  title: 'Delete Note',
  description: 'Permanently delete a note',
  keywords: ['remove', 'trash', 'destroy'],
  group: 'notes',
  closeOnSelect: false, // Keep open for file-browse + modal
  run: async () => {
    setPaletteMode('delete-browse');
  },
});
```

---

## Technical Implementation

### New Palette Modes

Add `'delete-browse'` and `'delete-confirm'` to `PaletteMode` type:

```typescript
type PaletteMode = 'command' | 'file-browse' | 'delete-browse' | 'delete-confirm';
```

### State Management

Add to CommandPalette state:

```typescript
// Track the note pending deletion (used when in 'delete-confirm' mode)
const [pendingDeleteNote, setPendingDeleteNote] = useState<Note | null>(null);

// Track which mode to return to after cancel (delete-browse or file-browse)
const [returnMode, setReturnMode] = useState<'delete-browse' | 'file-browse'>('delete-browse');
```

Mode transitions:

- `command` -> `delete-browse`: User selects "Delete Note" command
- `delete-browse` -> `delete-confirm`: User selects a note to delete
- `delete-confirm` -> `delete-browse`: User clicks Cancel or presses Escape
- `delete-confirm` -> (closed): User confirms deletion
- `delete-browse` -> `command`: User presses Escape or clicks back button
- `file-browse` -> `delete-confirm`: User clicks delete icon on a note
- `delete-confirm` -> `file-browse`: User clicks Cancel (when entered from `file-browse`)

### IPC Layer Changes

**Preload API** (`preload.ts`):

```typescript
notes: {
  // ... existing methods
  delete: (id: NoteId): Promise<{ success: boolean }>,
}
```

**Main Process** (`main.ts`):

```typescript
ipcMain.handle('notes:delete', async (_event, id: NoteId) => {
  await vault.delete(id);
  graphEngine.removeNote(id);
  searchEngine.removeNote(id);
  return { success: true };
});
```

### useNoteState Hook Extension

```typescript
interface UseNoteStateReturn {
  // ... existing properties
  deleteNote: (id: NoteId) => Promise<void>;
}
```

### Toast System

**useToast Hook** (`hooks/useToast.ts`):

```typescript
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface UseToastReturn {
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  dismissToast: (id: string) => void;
}
```

**Toast Component** (`components/Toast/Toast.tsx`):

```typescript
interface ToastProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}
```

**Usage in App.tsx**:

```typescript
const { toasts, showToast, dismissToast } = useToast();

// After successful deletion:
showToast(`"${noteTitle}" deleted`);

// After failed deletion:
showToast('Failed to delete note', 'error');
```

### Files to Modify

| File                                                        | Changes                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `renderer/src/commands/types.ts`                            | Add `'delete-browse'` and `'delete-confirm'` to `PaletteMode`           |
| `renderer/src/App.tsx`                                      | Register command, integrate Toast component                             |
| `renderer/src/components/CommandPalette/CommandPalette.tsx` | Add delete-browse mode, confirmation screen, delete icon in file-browse |
| `renderer/src/components/CommandPalette/CommandPalette.css` | Add confirmation screen and delete icon styles                          |
| `renderer/src/components/Toast/Toast.tsx`                   | New component for toast notifications                                   |
| `renderer/src/components/Toast/Toast.css`                   | Toast styles                                                            |
| `renderer/src/hooks/useNoteState.ts`                        | Add `deleteNote` method                                                 |
| `renderer/src/hooks/useToast.ts`                            | New hook for toast state management                                     |
| `electron/preload/src/preload.ts`                           | Add `notes.delete` IPC bridge                                           |
| `electron/main/src/main.ts`                                 | Add `notes:delete` handler                                              |

---

## CSS Specifications

### Delete Icon Styles (File-Browse Mode)

```css
.note-item {
  position: relative;
}

.note-item-delete-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
  color: #999999;
}

.note-item:hover .note-item-delete-icon {
  opacity: 1;
}

.note-item-delete-icon:hover {
  color: #dc3545;
  background-color: rgba(220, 53, 69, 0.1);
}

.note-item-delete-icon svg {
  width: 16px;
  height: 16px;
}
```

### Confirmation Screen Styles

```css
.delete-confirmation {
  padding: 24px;
  text-align: center;
}

.delete-confirmation-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.delete-confirmation-message {
  font-size: 14px;
  color: #666666;
  margin-bottom: 20px;
}

.delete-confirmation-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.delete-confirmation-cancel {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
}

.delete-confirmation-cancel:hover {
  background: #f5f5f5;
}

.delete-confirmation-confirm {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #dc3545;
  color: #ffffff;
  cursor: pointer;
}

.delete-confirmation-confirm:hover {
  background: #c82333;
}
```

### Toast Styles

```css
.toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  background-color: #1a1a1a;
  color: #ffffff;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 14px;
  max-width: 400px;
  pointer-events: auto;
  cursor: pointer;
  animation: toastSlideIn 0.2s ease-out;
}

.toast--error {
  background-color: #dc3545;
}

.toast--exiting {
  animation: toastSlideOut 0.15s ease-in forwards;
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toastSlideOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(16px);
  }
}
```

---

## Testing Plan

Aligned with [testing_strategy_and_design.md](../../architecture/testing_strategy_and_design.md).

### Unit Tests

**useNoteState.ts** - `deleteNote` method

| Test Case                | Condition                | Expected Result           |
| ------------------------ | ------------------------ | ------------------------- |
| Delete existing note     | Valid note ID            | Note removed, no error    |
| Delete non-existent note | Invalid note ID          | Graceful error handling   |
| Delete current note      | ID matches currentNoteId | currentNoteId set to null |

### Renderer Component Tests (`CommandPalette.test.tsx`)

**Mode switching**

| Test Case             | Action                                 | Expected Result                  |
| --------------------- | -------------------------------------- | -------------------------------- |
| "Delete Note" command | Select "Delete Note" from command mode | Switches to `delete-browse` mode |
| Escape returns        | Press `Escape` in `delete-browse`      | Returns to `command` mode        |
| Back button           | Click `<-` button                      | Returns to `command` mode        |

**Delete icon in file-browse mode**

| Test Case                | Action                         | Expected Result               |
| ------------------------ | ------------------------------ | ----------------------------- |
| Icon hidden by default   | View note item (not hovered)   | Delete icon not visible       |
| Icon visible on hover    | Hover over note item           | Delete icon appears on right  |
| Icon click opens confirm | Click delete icon              | Confirmation screen appears   |
| Icon click doesn't open  | Click delete icon              | Note does NOT open            |
| Cancel returns to browse | Click delete icon, then Cancel | Returns to `file-browse` mode |
| Confirm deletes note     | Click delete icon, then Delete | Note deleted, palette closes  |

**File selection in delete-browse mode**

| Test Case                 | Action                            | Expected Result                         |
| ------------------------- | --------------------------------- | --------------------------------------- |
| Note click                | Click on a note in list           | Confirmation screen appears             |
| Enter key                 | Press `Enter` on highlighted note | Confirmation screen appears             |
| Screen shows correct note | Select "Meeting Notes"            | Screen title: `Delete "Meeting Notes"?` |

**Confirmation screen behavior**

| Test Case      | Action                | Expected Result              |
| -------------- | --------------------- | ---------------------------- |
| Cancel button  | Click Cancel          | Return to delete-browse mode |
| Delete button  | Click Delete          | Note deleted, palette closes |
| Escape key     | Press Escape          | Return to delete-browse mode |
| Enter key      | Press Enter           | Note deleted, palette closes |
| Backdrop click | Click outside palette | Palette closes entirely      |

**Post-deletion state**

| Test Case           | Condition                             | Expected Result                   |
| ------------------- | ------------------------------------- | --------------------------------- |
| Delete non-current  | Delete note that isn't currently open | Current note remains loaded       |
| Delete current note | Delete the currently open note        | Most recent remaining note opened |
| Delete last note    | Only one note in vault                | New note silently created         |

**Error handling**

| Test Case      | Condition         | Expected Result               |
| -------------- | ----------------- | ----------------------------- |
| Deletion fails | IPC returns error | Error toast shown             |
| Stay in mode   | After error       | Remains in delete-browse mode |

**Toast notifications**

| Test Case             | Action                     | Expected Result                        |
| --------------------- | -------------------------- | -------------------------------------- |
| Success toast shown   | Delete note successfully   | Toast shows `"{note-title}" deleted`   |
| Error toast shown     | Deletion fails             | Toast shows "Failed to delete note"    |
| Toast auto-dismisses  | Wait 3 seconds             | Toast disappears                       |
| Toast click dismisses | Click on toast             | Toast disappears immediately           |
| Long title truncated  | Delete note with long name | Title truncated with ellipsis in toast |

### Toast Component Tests (`Toast.test.tsx`)

| Test Case             | Action                  | Expected Result                  |
| --------------------- | ----------------------- | -------------------------------- |
| Renders message       | Show toast with message | Message text visible             |
| Success style         | Show success toast      | Default (dark) styling applied   |
| Error style           | Show error toast        | Red/error styling applied        |
| Auto-dismiss          | Wait for duration       | Toast removed after 3s           |
| Click to dismiss      | Click toast             | Toast removed immediately        |
| Multiple toasts stack | Show 2 toasts           | Both visible, stacked vertically |
| Exit animation        | Dismiss toast           | Slide-out animation plays        |

### IPC Contract Tests

| Test Case            | Channel        | Validation                            |
| -------------------- | -------------- | ------------------------------------- |
| Delete note          | `notes:delete` | Returns `{ success: true }`           |
| Delete non-existent  | `notes:delete` | Returns error or `{ success: false }` |
| Error response shape | `notes:delete` | Matches expected error interface      |

### E2E Tests (Integration)

**Flow 1: Delete note via command palette**

1. Launch app with 3+ existing notes
2. Press `Cmd+K`
3. Type "delete" and select "Delete Note" command
4. Verify `delete-browse` mode with note list
5. Press `Down` then `Enter` to select a note
6. Verify confirmation screen appears
7. Click "Delete" button
8. Verify success toast appears with note title
9. Verify note is deleted (not in list)
10. Verify toast auto-dismisses after 3 seconds

**Flow 2: Cancel deletion**

1. Press `Cmd+K`, select "Delete Note"
2. Select a note
3. Press `Escape` in confirmation screen
4. Verify return to `delete-browse` mode
5. Verify note still exists in list

**Flow 3: Delete current note**

1. Open a specific note in editor
2. Press `Cmd+K`, select "Delete Note"
3. Select the currently open note
4. Confirm deletion
5. Verify most recent remaining note is opened in editor

**Flow 4: Delete last note in vault**

1. Launch app with only 1 note
2. Press `Cmd+K`, select "Delete Note"
3. Select the note
4. Confirm deletion
5. Verify new note is silently created and displayed in editor

**Flow 5: Delete via icon in file-browse mode**

1. Launch app with 3+ existing notes
2. Press `Cmd+O` to open file-browse mode
3. Hover over a note item
4. Verify delete icon appears on right side
5. Click delete icon
6. Verify confirmation screen appears
7. Click "Cancel"
8. Verify return to `file-browse` mode (not `delete-browse`)
9. Hover and click delete icon again
10. Click "Delete" to confirm
11. Verify note is deleted and palette closes

### Test File Locations

| Test Type                | Location                                                         |
| ------------------------ | ---------------------------------------------------------------- |
| Unit: useNoteState       | `renderer/src/hooks/useNoteState.test.ts`                        |
| Unit: useToast           | `renderer/src/hooks/useToast.test.ts`                            |
| Renderer: CommandPalette | `renderer/src/components/CommandPalette/CommandPalette.test.tsx` |
| Renderer: Toast          | `renderer/src/components/Toast/Toast.test.tsx`                   |
| E2E                      | `apps/desktop/delete-note.integration.test.ts`                   |

---

## Accessibility

| Requirement                | Implementation                                          |
| -------------------------- | ------------------------------------------------------- |
| Focus trap in modal        | Focus stays within modal when open                      |
| Focus on modal open        | Focus moves to Cancel button (safer default)            |
| Screen reader announcement | Modal title read aloud on open                          |
| Keyboard navigation        | Full keyboard support (Tab, Enter, Escape)              |
| ARIA attributes            | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` |

---

## Future Considerations

- **Soft delete / Trash**: Move to trash instead of permanent deletion
- **Undo**: Brief undo window after deletion
- **Batch delete**: Select multiple notes for deletion
- **Delete from context menu**: Right-click on note in sidebar (future feature)
