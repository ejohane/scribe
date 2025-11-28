# Scribe Redesign - Feature Breakdown

This document breaks down the POC redesign into discrete features that can be implemented incrementally. Each feature is scoped to be independently deliverable.

---

## Overview: POC vs Current App

### Current Desktop App Has:
- EditorRoot (Lexical-based)
- CommandPalette (complex, multi-mode)
- BackButton (wiki-link navigation)
- Toast notifications
- ErrorNotification
- Backlinks overlay (inline panel)
- WikiLink + PersonMention plugins

### POC Introduces:
- Three-panel layout (sidebar, editor, context panel)
- Floating action dock
- Redesigned sidebar with note list
- Right context panel (linked mentions, tasks, calendar)
- Selection toolbar (floating formatting menu)
- Slash command menu (floating)
- Mention autocomplete (floating)
- Note link autocomplete (floating)
- Updated command palette design
- Dark mode toggle in sidebar

---

## Feature 1: Design System Color Palette Update

**Priority:** P0 (Prerequisite)  
**Scope:** Design system package only  
**Estimate:** Small

### Description
Update the design system color tokens to match the POC's cooler, neutral palette.

### Files to Modify
- `packages/design-system/src/themes/light.css.ts`
- `packages/design-system/src/themes/dark.css.ts`
- `packages/design-system/src/tokens/contract.css.ts` (add `xl`/`2xl` radius, `xl` shadow, `serif` font)

### Deliverables
- [ ] Update light theme colors
- [ ] Update dark theme colors
- [ ] Add new token values (radius.xl, radius.2xl, shadow.xl, fontFamily.serif)
- [ ] Update spec documentation

### Reference
- `features/redesign/color-palette.md`

---

## Feature 2: App Shell Layout

**Priority:** P0 (Foundation)  
**Scope:** Desktop app layout  
**Estimate:** Medium

### Description
Create the three-panel responsive layout shell that contains the sidebar, main content area, and context panel.

### Components to Create
```
renderer/src/
  layouts/
    AppShell/
      AppShell.tsx
      AppShell.css.ts
      index.ts
```

### Props/API
```typescript
interface AppShellProps {
  sidebar?: ReactNode;
  main: ReactNode;
  contextPanel?: ReactNode;
  sidebarOpen?: boolean;
  contextPanelOpen?: boolean;
}
```

### Behavior
- Sidebar: 320px width, collapsible with animation
- Main: Flexible, centered content with max-width
- Context panel: 320px width, collapsible with animation
- Titlebar drag region preserved
- Responsive transitions (cubic-bezier easing from POC)

### Deliverables
- [ ] AppShell component with three-panel layout
- [ ] Collapse/expand animations for sidebars
- [ ] CSS-in-JS styles using design tokens
- [ ] Integration with existing App.tsx

---

## Feature 3: Sidebar (Note List)

**Priority:** P1  
**Scope:** New component  
**Estimate:** Medium

### Description
Left sidebar showing the note library with search, create, and note list functionality.

### Components to Create
```
renderer/src/
  components/
    Sidebar/
      Sidebar.tsx
      Sidebar.css.ts
      NoteListItem.tsx
      NoteListItem.css.ts
      index.ts
```

### Props/API
```typescript
interface SidebarProps {
  isOpen: boolean;
  notes: NoteMetadata[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
}

interface NoteListItemProps {
  note: NoteMetadata;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}
```

### Sections
1. **Header**: App name ("Scribe"), "LIBRARY" label
2. **New Note Button**: Icon + text, hover states
3. **Note List**: Scrollable, shows title + relative timestamp
4. **Footer**: User avatar placeholder, theme toggle

### Behavior
- Notes sorted by `updatedAt` (most recent first)
- Active note highlighted with ring/shadow
- Delete button appears on hover
- Timestamps using `date-fns` formatDistanceToNow
- Smooth collapse animation

### Deliverables
- [ ] Sidebar container component
- [ ] NoteListItem component
- [ ] New Note button
- [ ] Theme toggle in footer
- [ ] Delete confirmation (reuse existing pattern)
- [ ] Integration with note state

---

## Feature 4: Floating Action Dock

**Priority:** P1  
**Scope:** New component  
**Estimate:** Small

### Description
Bottom-centered floating toolbar with quick actions: sidebar toggle, search (Cmd+K), context panel toggle.

### Components to Create
```
renderer/src/
  components/
    FloatingDock/
      FloatingDock.tsx
      FloatingDock.css.ts
      index.ts
```

### Props/API
```typescript
interface FloatingDockProps {
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  onToggleSidebar: () => void;
  onToggleContextPanel: () => void;
  onOpenSearch: () => void;
}
```

### Design
- Pill-shaped container with glassmorphism
- Three sections separated by dividers:
  1. Sidebar toggle (hamburger icon)
  2. Search button with "Cmd+K" badge
  3. Context panel toggle (sidebar icon, rotated)
- Hover scale effect
- Elevated shadow

### Deliverables
- [ ] FloatingDock component
- [ ] Icon buttons with active states
- [ ] Keyboard shortcut badges
- [ ] Glassmorphism styling
- [ ] Hover animations

---

## Feature 5: Context Panel (Right Sidebar)

**Priority:** P2  
**Scope:** New component  
**Estimate:** Medium

### Description
Right panel showing contextual information about the current note: linked mentions (backlinks), tasks, and calendar.

### Components to Create
```
renderer/src/
  components/
    ContextPanel/
      ContextPanel.tsx
      ContextPanel.css.ts
      LinkedMentions.tsx
      TasksWidget.tsx
      CalendarWidget.tsx
      index.ts
```

### Props/API
```typescript
interface ContextPanelProps {
  isOpen: boolean;
  currentNoteId: string | null;
}

interface LinkedMentionsProps {
  backlinks: GraphNode[];
  onSelectBacklink: (id: string) => void;
}
```

### Sections
1. **CONTEXT Header**
2. **Linked Mentions Card**: Shows notes referencing current note (uses existing backlinks API)
3. **Tasks Card**: Checkbox list extracted from note content (future)
4. **CALENDAR Header**
5. **Upcoming Card**: Date pills + events (future/placeholder)

### Deliverables
- [ ] ContextPanel container with collapse animation
- [ ] LinkedMentions component (replaces backlinks overlay)
- [ ] TasksWidget placeholder
- [ ] CalendarWidget placeholder
- [ ] Card styling using Surface primitive

---

## Feature 6: Command Palette Redesign

**Priority:** P1  
**Scope:** Update existing component  
**Estimate:** Medium

### Description
Update the existing CommandPalette to match the POC's visual design while preserving all functionality.

### Files to Modify
- `renderer/src/components/CommandPalette/CommandPalette.tsx`
- `renderer/src/components/CommandPalette/CommandPalette.css.ts`

### Visual Changes
- Larger border radius (rounded-2xl → radius.xl)
- Refined input styling with ESC badge
- Cleaner result items with file icons
- "Create New Note" option always visible at bottom
- Softer shadows and backdrop blur
- Ring border effect

### Preserve
- All existing modes (command, file-browse, delete-browse, delete-confirm, prompt-input)
- Keyboard navigation
- Fuzzy search
- All tests

### Deliverables
- [ ] Update container styling
- [ ] Update input styling with ESC badge
- [ ] Update result item styling
- [ ] Update "Create" action styling
- [ ] Verify all existing tests pass

---

## Feature 7: Editor Title Input

**Priority:** P1  
**Scope:** Update existing component  
**Estimate:** Small

### Description
Add a prominent title input above the editor content, auto-resizing textarea style.

### Files to Modify
- `renderer/src/components/Editor/EditorRoot.tsx`
- `renderer/src/components/Editor/EditorRoot.css.ts`

### Design
- Large serif font (text-4xl to text-5xl)
- Placeholder: "Untitled"
- No border, transparent background
- Auto-resize on content change
- Margin below before editor content

### Behavior
- Title extracted from first H1 or separate field
- Updates note metadata on change
- Tab from title focuses editor

### Deliverables
- [ ] Title textarea component
- [ ] Auto-resize logic
- [ ] Integration with note state
- [ ] Styling with design tokens

---

## Feature 8: Selection Toolbar

**Priority:** P2  
**Scope:** New component  
**Estimate:** Medium

### Description
Floating toolbar that appears above selected text with formatting options.

### Components to Create
```
renderer/src/
  components/
    Editor/
      SelectionToolbar/
        SelectionToolbar.tsx
        SelectionToolbar.css.ts
        index.ts
```

### Props/API
```typescript
interface SelectionToolbarProps {
  position: { top: number; left: number } | null;
  onFormat: (format: FormatType) => void;
}

type FormatType = 'bold' | 'italic' | 'underline' | 'strike' | 'h1' | 'h2' | 'highlight' | 'link' | 'ai-edit';
```

### Design
- Appears above selection, centered
- Sections separated by dividers:
  1. Bold, Italic, Underline, Strikethrough
  2. H1, H2, Highlight
  3. Link, "Ask AI" button
- Triangle pointer below
- Animate in with fade + scale

### Behavior
- Shows on text selection in editor
- Hides when selection collapses
- Prevent focus loss on click (mousedown preventDefault)
- Executes Lexical formatting commands

### Deliverables
- [ ] SelectionToolbar component
- [ ] Position calculation logic
- [ ] Format button components
- [ ] Integration with Lexical editor
- [ ] Animation styling

---

## Feature 9: Slash Command Menu

**Priority:** P2  
**Scope:** New component  
**Estimate:** Medium

### Description
Floating menu triggered by typing "/" in the editor, showing block formatting and AI commands.

### Components to Create
```
renderer/src/
  components/
    Editor/
      SlashMenu/
        SlashMenu.tsx
        SlashMenu.css.ts
        SlashMenuItem.tsx
        index.ts
```

### Props/API
```typescript
interface SlashMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
}
```

### Commands
- Text (plain paragraph)
- Heading 1
- Heading 2
- Bullet List
- To-do (checkbox)
- Quote (blockquote)
- Continue (AI generation)
- Summarize (AI summary)

### Behavior
- Trigger on "/" typed at start of line or after space
- Filter commands by query
- Keyboard navigation (up/down/enter/escape)
- Remove trigger text on selection
- Execute Lexical commands

### Deliverables
- [ ] SlashMenu component
- [ ] SlashMenuItem component
- [ ] Trigger detection plugin
- [ ] Command execution logic
- [ ] Keyboard navigation
- [ ] Animation styling

---

## Feature 10: Mention Autocomplete (@)

**Priority:** P3  
**Scope:** Update existing component  
**Estimate:** Small

### Description
Update the existing PersonMentionAutocomplete to match the POC's floating menu design.

### Files to Modify
- `renderer/src/components/Editor/plugins/PersonMentionAutocomplete.tsx`
- Create new CSS file with design tokens

### Visual Changes
- Match floating menu styling from SlashMenu
- User icon in colored circle
- Consistent item height and padding

### Preserve
- Existing trigger logic
- Keyboard navigation
- Person lookup functionality

### Deliverables
- [ ] Update styling to match SlashMenu
- [ ] Verify existing tests pass

---

## Feature 11: Note Link Autocomplete ([[)

**Priority:** P3  
**Scope:** Update existing component  
**Estimate:** Small

### Description
Update the existing WikiLinkAutocomplete to match the POC's floating menu design.

### Files to Modify
- `renderer/src/components/Editor/plugins/WikiLinkAutocomplete.tsx`
- Update CSS to use design tokens

### Visual Changes
- Match floating menu styling from SlashMenu
- File icon for each note
- Consistent item height and padding

### Preserve
- Existing trigger logic
- Keyboard navigation
- Note lookup and creation functionality

### Deliverables
- [ ] Update styling to match SlashMenu
- [ ] Verify existing tests pass

---

## Implementation Order

### Phase 1: Foundation
1. **Feature 1**: Design System Color Palette Update
2. **Feature 2**: App Shell Layout

### Phase 2: Core Navigation
3. **Feature 3**: Sidebar (Note List)
4. **Feature 4**: Floating Action Dock
5. **Feature 6**: Command Palette Redesign

### Phase 3: Editor Enhancements
6. **Feature 7**: Editor Title Input
7. **Feature 8**: Selection Toolbar
8. **Feature 9**: Slash Command Menu

### Phase 4: Context & Polish
9. **Feature 5**: Context Panel (Right Sidebar)
10. **Feature 10**: Mention Autocomplete (@)
11. **Feature 11**: Note Link Autocomplete ([[)

---

## Dependencies

```
Feature 1 (Colors)
    └── Feature 2 (App Shell)
            ├── Feature 3 (Sidebar)
            ├── Feature 4 (Floating Dock)
            └── Feature 5 (Context Panel)
                    └── (uses existing backlinks API)

Feature 6 (Command Palette) - independent, can parallel with 2-5

Feature 7 (Title Input)
    └── Feature 8 (Selection Toolbar)
            └── Feature 9 (Slash Menu)

Feature 10 (Mention) - depends on Feature 9 styling
Feature 11 (Note Link) - depends on Feature 9 styling
```

---

## Out of Scope (Future)

These items are visible in the POC but not planned for initial implementation:

- **Calendar integration**: Real calendar data
- **Task extraction**: Parsing checkboxes from note content
- **User accounts**: Real user system (currently placeholder)
- **AI features**: Continue/Summarize (requires backend integration)
- **Mobile responsive**: Focus on desktop Electron first
