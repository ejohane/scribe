# Feature: Note Templates

**Status**: Draft  
**Created**: 2024-12-02  
**GitHub Issue**: TBD

## Overview

Implement a template system that allows different types of notes to have predefined layouts, custom titles, metadata, and specialized right panel configurations. Templates define how notes are created, displayed, and what contextual information is shown alongside them.

For MVP, we implement two built-in templates: **Daily Notes** and **Meetings**. User-created custom templates are out of scope for MVP but the architecture supports future extensibility.

---

## Goals

1. Allow specialized note types with predefined structure and metadata
2. Support dynamic title rendering based on note type and context
3. Enable template-specific right panel (ContextPanel) configurations
4. Provide command palette integration for creating templated notes
5. Ensure daily notes are unique per date and meetings are linked to their associated daily note
6. Maintain consistency with existing architecture patterns (People, wiki-links)

---

## Non-Goals (Out of Scope for MVP)

- User-created custom templates
- Template editing UI
- Template import/export
- Template inheritance or composition
- Template versioning
- Meeting scheduling integration (calendar APIs)
- Recurring meetings
- Meeting invites/attendees from contacts app
- Creating meetings for past/future dates (MVP is today only)
- Creating daily notes for past/future dates via command (search only)

---

## Architecture Decision: Templates as Note Types with Configuration

Templates are implemented as **note types with associated configuration objects** rather than a separate entity system. This approach:

- Leverages existing `NoteType` discriminator infrastructure
- Reuses 100% of existing note storage, editing, and indexing
- Allows template-specific behavior via configuration lookup
- Enables future extensibility for user-defined templates
- Maintains data model consistency with People feature

### Template Registry

A template registry maps note types to their configuration:

```typescript
interface TemplateConfig {
  /** Note type this template applies to */
  type: NoteType;
  
  /** Display name for the template */
  displayName: string;
  
  /** Default tags applied to notes of this type */
  defaultTags: string[];
  
  /** Function to generate the initial title */
  generateTitle: (context: TemplateContext) => string;
  
  /** Function to generate the display title (may differ from stored title) */
  renderTitle: (note: Note, context: TemplateContext) => string;
  
  /** Function to generate initial content */
  generateContent: (context: TemplateContext) => LexicalState;
  
  /** Right panel configuration for this template */
  contextPanelConfig: ContextPanelConfig;
  
  /** Whether this type should be searchable by date format */
  dateSearchable?: boolean;
}

interface TemplateContext {
  /** Target date for date-based templates */
  date: Date;
  /** User-provided input (e.g., meeting title) */
  userInput?: string;
}

interface ContextPanelConfig {
  /** Sections to display in the context panel */
  sections: ContextPanelSection[];
}

type ContextPanelSection = 
  | { type: 'linked-mentions'; includeByDate?: boolean }
  | { type: 'attendees' }
  | { type: 'tasks'; placeholder?: boolean }
  | { type: 'references' }
  | { type: 'calendar' };
```

---

## Data Structures

### Extended Note Type

Notes gain new top-level fields for template-specific data:

```typescript
// In packages/shared/src/types.ts
interface Note {
  id: NoteId;
  title: string;
  createdAt: number;
  updatedAt: number;
  type?: NoteType;
  tags: string[];
  content: LexicalState;
  metadata: NoteMetadata;
  
  /** Daily note specific data (only present for daily notes) */
  daily?: {
    date: string;  // Date string "MM-dd-yyyy"
  };
  
  /** Meeting specific data (only present for meeting notes) */
  meeting?: {
    date: string;        // Date string "MM-dd-yyyy"
    dailyNoteId: NoteId; // Associated daily note
    attendees: NoteId[]; // Person note IDs
  };
}
```

### NoteType

```typescript
// 'daily' and 'meeting' are already in NoteType union
export type NoteType = 'person' | 'project' | 'meeting' | 'daily' | 'template';
```

---

## Template 1: Daily Notes

Daily notes are date-based notes for capturing daily thoughts, tasks, and logs.

### Requirements

| Requirement | Description |
|-------------|-------------|
| **Unique per date** | Only one daily note can exist per calendar date |
| **Dynamic title** | Header shows "Today" if viewing today's note, otherwise "mm/dd/yyyy" |
| **Automatic tag** | All daily notes have the `daily` tag in `note.tags` |
| **Command palette** | Created via "Today" command (today only) |
| **Idempotent creation** | "Today" command opens existing note if one exists |
| **Date searchable** | Can be found by searching "mm/dd/yyyy" format only |
| **Stored title** | Title is stored as "MM-dd-yyyy" for reliable lookup |
| **No H1 in content** | Title displayed in header only, not in document body |

### Title Behavior

| Context | Display Title (Header) | Stored Title |
|---------|------------------------|--------------|
| Today's daily note | "Today" | "12-02-2024" |
| Past daily note | "12/02/2024" | "12-02-2024" |
| Future daily note | "12/05/2024" | "12-05-2024" |

### Initial Content

Daily notes start with an empty bulleted list (no H1 heading):

```typescript
function createDailyContent(): LexicalState {
  return {
    root: {
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [
            {
              type: 'listitem',
              children: [],
              direction: null,
              format: '',
              indent: 0,
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'daily',
  };
}
```

### Right Panel Configuration

Daily notes context panel sections (in order):
1. Linked Mentions (includes notes created/modified on this date)
2. Tasks (placeholder)
3. References
4. Calendar

### Linked Mentions for Daily Notes

For daily notes, the Linked Mentions section has expanded behavior beyond standard backlinks:

| Source | Description |
|--------|-------------|
| **Backlinks** | Notes that explicitly link to this daily note (standard behavior) |
| **Created on date** | Notes with `createdAt` timestamp matching this daily note's date |
| **Modified on date** | Notes with `updatedAt` timestamp matching this daily note's date |

This provides a comprehensive view of all note activity for that day, making the daily note a natural hub for reviewing what was worked on.

**Display**: Each mention shows an indicator of why it appears:
- No indicator for backlinks (standard)
- "Created" badge for notes created on this date
- "Modified" badge for notes modified on this date (but not created)

**Note**: A note may appear multiple times if it both links to the daily note AND was created/modified on that date. The UI should deduplicate, showing the note once with all applicable badges.

### Command: "Today"

| Property | Value |
|----------|-------|
| ID | `daily:today` |
| Title | Today |
| Description | Open or create today's daily note |
| Group | Notes |
| Keywords | daily, today, journal, date |
| Behavior | Opens existing daily note for today OR creates new one |

**Note**: This command only works for today. Past/future daily notes are accessed via search.

### Daily Note Lookup

Daily notes are found by their stored title (MM-dd-yyyy format):

```typescript
async function findDailyNote(date: Date): Promise<Note | null> {
  const dateStr = format(date, 'MM-dd-yyyy'); // "12-02-2024"
  const notes = vault.list();
  return notes.find(n => 
    n.type === 'daily' && n.title === dateStr
  ) ?? null;
}

async function getOrCreateDailyNote(date: Date): Promise<Note> {
  const existing = await findDailyNote(date);
  if (existing) return existing;
  
  const dateStr = format(date, 'MM-dd-yyyy');
  
  return await vault.create({
    type: 'daily',
    title: dateStr,
    tags: ['daily'],
    content: createDailyContent(),
    daily: {
      date: dateStr,
    },
  });
}
```

### Search Integration

Daily notes are searchable by formatted date (`mm/dd/yyyy` format only):

```typescript
// In search engine, index daily notes with formatted date alias
if (note.type === 'daily') {
  const date = parse(note.title, 'MM-dd-yyyy', new Date());
  const formatted = format(date, 'MM/dd/yyyy'); // "12/02/2024"
  indexField('title_alias', formatted);
}
```

When searching for a date format like "12/15/2024":
- If a daily note exists for that date, show it in results
- If no daily note exists, show a "Create daily note for 12/15/2024" option

---

## Template 2: Meeting Notes

Meeting notes are structured documents for capturing meeting content, attendees, and action items.

### Requirements

| Requirement | Description |
|-------------|-------------|
| **Predefined sections** | Pre-Read, Notes, Action Items (all H3 with bullet lists) |
| **Daily note link** | Automatically linked to today's daily note |
| **Auto-create daily** | If daily note doesn't exist for today, create it |
| **Custom title** | User provides meeting title at creation |
| **Automatic tag** | All meeting notes have the `meeting` tag in `note.tags` |
| **No H1 in content** | Title displayed in header only, not in document body |
| **Attendees tracking** | Right panel shows attendees list (managed via widget only) |
| **Reference extraction** | Right panel shows wiki-links and URLs from content |
| **Today only (MVP)** | Meetings are always created for today |

### Initial Content

Meeting notes start with H3 section headings, each followed by an empty bullet list (no H1):

```typescript
function createMeetingContent(): LexicalState {
  const createH3 = (text: string) => ({
    type: 'heading',
    tag: 'h3',
    children: [{ type: 'text', text }],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  });
  
  const emptyBulletList = () => ({
    type: 'list',
    listType: 'bullet',
    children: [
      {
        type: 'listitem',
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    ],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  });
  
  return {
    root: {
      children: [
        createH3('Pre-Read'),
        emptyBulletList(),
        createH3('Notes'),
        emptyBulletList(),
        createH3('Action Items'),
        emptyBulletList(),
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'meeting',
  };
}
```

### Meeting Data Storage

Meeting-specific data is stored in the top-level `note.meeting` field:

```typescript
interface Note {
  // ... existing fields
  meeting?: {
    date: string;        // ISO date string "YYYY-MM-DD"
    dailyNoteId: NoteId; // Associated daily note
    attendees: NoteId[]; // Person note IDs
  };
}
```

### Daily Note Linking

When creating a meeting note:

1. Find or create today's daily note
2. Store the daily note ID in `note.meeting.dailyNoteId`
3. The relationship is implicit—no wiki-link is inserted into the daily note
4. The meeting appears in the daily note's backlinks automatically

### Right Panel Configuration

Meeting notes context panel sections (in order):
1. Linked Mentions
2. Attendees
3. Tasks (placeholder)
4. References

**Note**: Meetings do NOT show the Calendar widget.

### Attendees Widget

```
┌─────────────────────────────────┐
│ Attendees                    +  │
├─────────────────────────────────┤
│ @John Smith                   × │
│ @Jane Doe                     × │
└─────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| **+ button** | Opens person autocomplete (same behavior as editor `@` mentions) |
| **Attendee row** | Click navigates to person's note |
| **× button** | Shown on hover; removes attendee from list |
| **Empty state** | "No attendees yet" message |

**Important**: Attendees are managed **only** through this widget. They are completely independent from `@person` mentions in the document content. Mentions in content do NOT auto-add to attendees, and adding via widget does NOT insert mentions into content.

### References Widget

```
┌─────────────────────────────────┐
│ References                      │
├─────────────────────────────────┤
│ Project Alpha                   │
│ Q4 Planning                     │
│ example.com/doc...              │
└─────────────────────────────────┘
```

Extracts from note content:
- Wiki-links (`[[note]]`) - displays the link's display text
- URLs (http/https links) - displays the link's alias text, or truncated URL if no alias

**Note**: Person mentions (`@person`) are NOT included in References (they're just inline references).

Each reference displays the link's display text (alias). If a URL has no alias, show the full URL truncated to fit on one line.

**Scope**: The References widget appears for **all note types**, not just meetings.

### Command: "New Meeting"

| Property | Value |
|----------|-------|
| ID | `meeting:create` |
| Title | New Meeting |
| Description | Create a new meeting note |
| Group | Notes |
| Keywords | meeting, notes, agenda |
| Behavior | Prompts for title, creates meeting linked to today |

### Command Flow

```
User: cmd+k → "New Meeting" → Enter
System: Opens prompt "Meeting title:"
User: Types "Q4 Planning Review" → Enter
System: 
  1. Finds or creates today's daily note
  2. Creates meeting note with:
     - Title: "Q4 Planning Review"
     - Type: 'meeting'
     - Tags: ['meeting']
     - Content: H3 sections with bullet lists
     - meeting: { date, dailyNoteId, attendees: [] }
  3. Navigates to new meeting note
```

---

## UI Specifications

### Dynamic Title Rendering

The editor header displays a computed title that may differ from the stored title:

```typescript
function getDisplayTitle(note: Note): string {
  if (note.type === 'daily') {
    const noteDate = parse(note.title, 'MM-dd-yyyy', new Date());
    const today = startOfDay(new Date());
    
    if (isSameDay(noteDate, today)) {
      return 'Today';
    }
    return format(noteDate, 'MM/dd/yyyy');
  }
  
  // Default: use stored title
  return note.title;
}
```

**Important**: The document content has NO H1 heading for daily or meeting notes. The title is displayed only in the header UI.

### Context Panel Rendering

The ContextPanel component reads the current note's type and renders sections based on the template configuration:

```typescript
function ContextPanel({ note, ...props }) {
  const config = templateRegistry.get(note.type);
  const sections = config?.contextPanelConfig.sections 
    ?? defaultContextPanelSections;
  
  return (
    <aside className={styles.contextPanel}>
      {sections.map(section => (
        <ContextPanelSection key={section.type} section={section} note={note} />
      ))}
    </aside>
  );
}
```

### Section Order by Note Type

| Note Type | Sections (in order) |
|-----------|---------------------|
| Daily | Linked Mentions, Tasks, References, Calendar |
| Meeting | Linked Mentions, Attendees, Tasks, References |
| Regular/Other | Linked Mentions, Tasks, References, Calendar |

---

## API Changes

### New IPC Channels

| Channel | Purpose | Input | Output |
|---------|---------|-------|--------|
| `daily:getOrCreate` | Get or create today's daily note | `{ date?: string }` | `Note` |
| `daily:find` | Find daily note for a date | `{ date: string }` | `Note \| null` |
| `meeting:create` | Create a new meeting (today only) | `{ title: string }` | `Note` |
| `meeting:addAttendee` | Add person to meeting | `{ noteId: NoteId, personId: NoteId }` | `{ success: boolean }` |
| `meeting:removeAttendee` | Remove person from meeting | `{ noteId: NoteId, personId: NoteId }` | `{ success: boolean }` |

### Preload API Extensions

```typescript
// In preload.ts
daily: {
  /** Get or create daily note for today */
  getOrCreate: (): Promise<Note> => 
    ipcRenderer.invoke('daily:getOrCreate', {}),
  
  /** Find daily note for a specific date (ISO format) */
  find: (date: string): Promise<Note | null> =>
    ipcRenderer.invoke('daily:find', { date }),
},

meeting: {
  /** Create a new meeting note for today */
  create: (title: string): Promise<Note> =>
    ipcRenderer.invoke('meeting:create', { title }),
  
  /** Add an attendee to a meeting */
  addAttendee: (noteId: NoteId, personId: NoteId): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('meeting:addAttendee', { noteId, personId }),
  
  /** Remove an attendee from a meeting */
  removeAttendee: (noteId: NoteId, personId: NoteId): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('meeting:removeAttendee', { noteId, personId }),
},
```

### TypeScript Declaration Updates

```typescript
// In apps/desktop/renderer/src/types/scribe.d.ts
interface DailyAPI {
  getOrCreate(): Promise<Note>;
  find(date: string): Promise<Note | null>;
}

interface MeetingAPI {
  create(title: string): Promise<Note>;
  addAttendee(noteId: NoteId, personId: NoteId): Promise<{ success: boolean }>;
  removeAttendee(noteId: NoteId, personId: NoteId): Promise<{ success: boolean }>;
}

interface ScribeAPI {
  // Existing...
  notes: NotesAPI;
  search: SearchAPI;
  graph: GraphAPI;
  app: AppAPI;
  people: PeopleAPI;
  
  // New
  daily: DailyAPI;
  meeting: MeetingAPI;
}
```

---

## Main Process Handlers

```typescript
// In main.ts

// Daily: Get or create (today only)
ipcMain.handle('daily:getOrCreate', async () => {
  if (!vault) throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED);
  
  const today = new Date();
  const dateStr = format(today, 'MM-dd-yyyy');
  
  // Find existing daily note
  const notes = vault.list();
  const existing = notes.find(n => n.type === 'daily' && n.title === dateStr);
  if (existing) return existing;
  
  // Create new daily note
  const content = createDailyContent();
  const note = await vault.create({
    type: 'daily',
    title: dateStr,
    tags: ['daily'],
    content,
    daily: {
      date: dateStr,
    },
  });
  
  graphEngine!.addNote(note);
  searchEngine!.indexNote(note);
  
  return note;
});

// Daily: Find by date
ipcMain.handle('daily:find', async (_, { date }: { date: string }) => {
  if (!vault) throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED);
  
  const notes = vault.list();
  return notes.find(n => n.type === 'daily' && n.title === date) ?? null;
});

// Meeting: Create (today only)
ipcMain.handle('meeting:create', async (_, { title }: { title: string }) => {
  if (!vault) throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED);
  if (!title?.trim()) throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Meeting title required');
  
  const today = new Date();
  const dateStr = format(today, 'MM-dd-yyyy');
  
  // Ensure daily note exists
  let dailyNote = vault.list().find(n => n.type === 'daily' && n.title === dateStr);
  if (!dailyNote) {
    dailyNote = await vault.create({
      type: 'daily',
      title: dateStr,
      tags: ['daily'],
      content: createDailyContent(),
      daily: { date: dateStr },
    });
    graphEngine!.addNote(dailyNote);
    searchEngine!.indexNote(dailyNote);
  }
  
  // Create meeting note
  const content = createMeetingContent();
  const note = await vault.create({
    type: 'meeting',
    title: title.trim(),
    tags: ['meeting'],
    content,
    meeting: {
      date: dateStr,
      dailyNoteId: dailyNote.id,
      attendees: [],
    },
  });
  
  graphEngine!.addNote(note);
  searchEngine!.indexNote(note);
  
  return note;
});

// Meeting: Add attendee
ipcMain.handle('meeting:addAttendee', async (_, { noteId, personId }) => {
  if (!vault) throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED);
  
  const note = vault.read(noteId);
  if (note.type !== 'meeting') {
    throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Note is not a meeting');
  }
  
  const attendees = note.meeting?.attendees ?? [];
  if (attendees.includes(personId)) {
    return { success: true }; // Already added (idempotent)
  }
  
  const updatedNote = {
    ...note,
    meeting: {
      ...note.meeting!,
      attendees: [...attendees, personId],
    },
  };
  
  await vault.save(updatedNote);
  return { success: true };
});

// Meeting: Remove attendee
ipcMain.handle('meeting:removeAttendee', async (_, { noteId, personId }) => {
  if (!vault) throw new ScribeError(ErrorCode.VAULT_NOT_INITIALIZED);
  
  const note = vault.read(noteId);
  if (note.type !== 'meeting') {
    throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Note is not a meeting');
  }
  
  const attendees = note.meeting?.attendees ?? [];
  const updatedNote = {
    ...note,
    meeting: {
      ...note.meeting!,
      attendees: attendees.filter(id => id !== personId),
    },
  };
  
  await vault.save(updatedNote);
  return { success: true };
});
```

---

## Command Palette Integration

### New Commands

```typescript
// renderer/src/commands/templates.ts

export const templateCommands: Command[] = [
  {
    id: 'daily:today',
    title: 'Today',
    description: 'Open or create today\'s daily note',
    group: 'notes',
    keywords: ['daily', 'today', 'journal', 'date'],
    closeOnSelect: true,
    run: async (context) => {
      const note = await window.scribe.daily.getOrCreate();
      context.navigateToNote(note.id);
    },
  },
  {
    id: 'meeting:create',
    title: 'New Meeting',
    description: 'Create a new meeting note',
    group: 'notes',
    keywords: ['meeting', 'notes', 'agenda'],
    closeOnSelect: true,
    run: async (context) => {
      const title = await context.promptInput('Meeting title');
      if (!title) return;
      
      const note = await window.scribe.meeting.create(title);
      context.navigateToNote(note.id);
    },
  },
];
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| Daily note already exists | "Today" command opens existing, doesn't create duplicate |
| Meeting without title | Prompt validation prevents empty title |
| Add duplicate attendee | Silently succeeds (idempotent) |
| Remove non-existent attendee | Silently succeeds (idempotent) |
| Daily note deletion | Meetings linked to it retain stale `dailyNoteId`; meeting works normally |
| Person deletion | Attendees list retains stale ID; UI shows "Unknown" |
| Timezone edge cases | All dates use local timezone, stored as ISO strings |
| Searching "today" | Does not find daily note (use command or date format) |
| Searching "12/02/2024" | If exists: shows in results. If not: shows "Create daily note for 12/02/2024" option |
| Orphaned meeting | Meeting with deleted daily note works normally, no special indicator |
| Daily mentions - many notes | Large number of notes created/modified on date | Paginate or limit display (e.g., show 20 with "Show more") |
| Daily mentions - timezone | Note created at 11:59 PM local | Appears on that day's daily note, not next day |

---

## Testing Plan

### Unit Tests

**Template Registry** (`templates/registry.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Get daily template | Returns correct config for 'daily' type |
| Get meeting template | Returns correct config for 'meeting' type |
| Unknown type | Returns undefined for unregistered types |

**Daily Note Title Rendering** (`templates/daily.test.ts`)

| Test Case | Input | Expected |
|-----------|-------|----------|
| Today's note | Date = today | "Today" |
| Yesterday's note | Date = yesterday | "MM/dd/yyyy" format |
| Future note | Date = tomorrow | "MM/dd/yyyy" format |

**Meeting Data** (`storage.test.ts`)

| Test Case | Description |
|-----------|-------------|
| Meeting type set | Meeting notes have `type: 'meeting'` |
| Meeting data stored | `meeting` field present on note |
| Attendees persisted | Adding/removing updates `note.meeting.attendees` correctly |

### Component Tests

**Attendees Widget** (`AttendeesWidget.test.tsx`)

| Test Case | Action | Expected |
|-----------|--------|----------|
| Render attendees | Load meeting with 2 attendees | Shows 2 rows |
| Add attendee | Click +, select person | Person added to list |
| Remove attendee | Hover row, click × | Person removed |
| Empty state | No attendees | Shows "No attendees yet" message |
| Navigate to person | Click attendee name | Opens person note |

**References Widget** (`ReferencesWidget.test.tsx`)

| Test Case | Action | Expected |
|-----------|--------|----------|
| Extract wiki-links | Content has `[[Note]]` | Shows in references with display text |
| Extract URLs | Content has URL | Shows in references |
| URL with alias | Link has alias text | Shows alias, not URL |
| URL without alias | Link has no alias | Shows truncated URL |
| Click wiki-link | Click reference | Navigates to note |
| Empty state | No references | Shows "No references" message |
| Shows for all types | View regular note | References widget visible |

**Dynamic Title** (`EditorHeader.test.tsx`)

| Test Case | Action | Expected |
|-----------|--------|----------|
| Daily today | View today's daily | Header shows "Today" |
| Daily past | View past daily | Header shows formatted date |
| Meeting | View meeting | Header shows meeting title |
| Regular note | View regular note | Header shows note title |

**Daily Linked Mentions** (`LinkedMentionsWidget.test.tsx`)

| Test Case | Action | Expected |
|-----------|--------|----------|
| Shows backlinks | Note links to daily note | Appears in linked mentions |
| Shows created notes | Note created on daily note's date | Appears with "Created" badge |
| Shows modified notes | Note modified on daily note's date | Appears with "Modified" badge |
| Deduplicates | Note links AND was created on date | Appears once with both indicators |
| Excludes self | Daily note itself | Does not appear in its own mentions |
| Regular note behavior | View non-daily note | Only shows backlinks (no date-based notes) |

### Integration Tests

**Flow 1: Create daily note via command**

1. Open command palette
2. Type "Today"
3. Select command
4. Verify new daily note created with:
   - Title: today's date (MM-dd-yyyy format)
   - Type: 'daily'
   - Tags: ['daily']
   - Content: empty bullet list (no H1)
   - daily: { date: MM-dd-yyyy format }
5. Header displays "Today"
6. Run "Today" command again
7. Verify same note opened (no duplicate)

**Flow 2: Create meeting note**

1. Open command palette
2. Type "New Meeting"
3. Enter title "Team Sync"
4. Verify:
   - Meeting note created with H3 sections and bullet lists (no H1)
   - Title: "Team Sync"
   - Type: 'meeting'
   - Tags: ['meeting']
   - Daily note created/found
   - `note.meeting.dailyNoteId` set
   - Navigation to meeting note
5. Header displays "Team Sync"

**Flow 3: Meeting attendees management**

1. Create meeting note
2. Open meeting note
3. In context panel, click + to add attendee
4. Verify person autocomplete opens (same as editor)
5. Select person
6. Verify attendee appears in list
7. Hover attendee, click ×
8. Verify attendee removed

**Flow 4: Search daily note by date**

1. Create daily note for today
2. Search today's date in mm/dd/yyyy format
3. Verify daily note appears in results
4. Search a date with no daily note (e.g., "12/25/2024")
5. Verify "Create daily note for 12/25/2024" option appears
6. Select create option
7. Verify daily note created and opened

**Flow 5: Daily note shows notes created/modified on that day**

1. Create daily note for today
2. Create a regular note "Project Ideas"
3. Open today's daily note
4. Verify "Project Ideas" appears in Linked Mentions with "Created" badge
5. Create another note "Old Note" (simulate as created yesterday by backdating)
6. Modify "Old Note" today
7. Verify "Old Note" appears in Linked Mentions with "Modified" badge
8. Add wiki-link `[[12-02-2024]]` to "Old Note" content
9. Verify "Old Note" still appears once (deduplicated) with backlink + "Modified" indicators
10. Verify daily note does not appear in its own Linked Mentions

---

## Implementation Order

### Phase 1: Core Types & Data Model
1. **Extend Note type** - Add `daily` and `meeting` top-level fields to Note interface
2. **Update storage layer** - Support creating/saving notes with new fields
3. **Template types** - Define `TemplateConfig`, `TemplateContext`, `ContextPanelConfig`
4. **Template registry** - Create registry with daily and meeting configs

### Phase 2: Daily Notes
5. **Daily API** - IPC handlers for `getOrCreate` and `find`
6. **Preload extension** - Add `daily` namespace
7. **"Today" command** - Command palette integration
8. **Daily title rendering** - Dynamic "Today" / date display in header
9. **Daily content generation** - Empty bullet list
10. **Search integration** - Index daily notes by mm/dd/yyyy format, show create option

### Phase 3: Meeting Notes
11. **Meeting API** - IPC handlers for create, addAttendee, removeAttendee
12. **Preload extension** - Add `meeting` namespace
13. **"New Meeting" command** - Command palette with title prompt
14. **Meeting content generation** - H3 sections with bullet lists
15. **Daily note linking** - Auto-create and link on meeting creation

### Phase 4: Context Panel Extensions
16. **Attendees widget** - New widget component with person autocomplete
17. **References widget** - Extract and display wiki-links and URLs from content
18. **Template-based panel config** - Render sections based on note type

### Phase 5: Polish & Testing
19. **Integration tests** - Full flow tests
20. **Edge case handling** - Deletion, validation, orphaned references

---

## Files to Create

| File | Purpose |
|------|---------|
| `renderer/src/templates/types.ts` | Template type definitions |
| `renderer/src/templates/registry.ts` | Template configuration registry |
| `renderer/src/templates/daily.ts` | Daily note template config |
| `renderer/src/templates/meeting.ts` | Meeting note template config |
| `renderer/src/commands/templates.ts` | Template-related commands |
| `renderer/src/components/ContextPanel/AttendeesWidget.tsx` | Attendees widget |
| `renderer/src/components/ContextPanel/AttendeesWidget.css.ts` | Attendees styles |
| `renderer/src/components/ContextPanel/ReferencesWidget.tsx` | References widget |
| `renderer/src/components/ContextPanel/ReferencesWidget.css.ts` | References styles |

## Files to Modify

| File | Changes |
|------|---------|
| `packages/shared/src/types.ts` | Add `daily` and `meeting` fields to Note interface |
| `packages/storage-fs/src/storage.ts` | Support new Note fields in create/save |
| `apps/desktop/electron/main/src/main.ts` | Add daily/meeting IPC handlers |
| `apps/desktop/electron/preload/src/preload.ts` | Add daily/meeting APIs |
| `apps/desktop/renderer/src/types/scribe.d.ts` | Type declarations for new APIs |
| `apps/desktop/renderer/src/components/Editor/EditorHeader.tsx` | Dynamic title rendering |
| `apps/desktop/renderer/src/components/ContextPanel/ContextPanel.tsx` | Template-based sections |
| `apps/desktop/renderer/src/commands/index.ts` | Register template commands |
| `packages/engine-search/src/search-engine.ts` | Index daily notes by formatted date |

---

## Future Considerations

- **User-defined templates** - UI for creating custom templates with sections
- **Template from note** - Convert existing note to template
- **Meeting scheduling** - Integration with calendar APIs
- **Recurring daily notes** - Auto-create daily note on app open
- **Weekly/monthly notes** - Expand date-based notes beyond daily
- **Meeting series** - Link related meetings together
- **Task extraction** - Parse action items from meeting content
- **Attendee suggestions** - Suggest frequently co-mentioned people
- **Template shortcuts** - Hotkeys for common templates
- **Template preview** - See template structure before creating
- **Past/future meeting creation** - Date picker for meetings
- **Multiple date format search** - Support more date formats for daily note lookup
