/**
 * Core type definitions for Scribe
 *
 * These types define the foundational data structures used across all engine modules
 * and in communication between layers (renderer, preload, main).
 */

/**
 * Unique identifier for a note
 *
 * This is a branded type to prevent accidental mixing with other string types.
 * Use createNoteId() to create instances.
 */
export type NoteId = string & { readonly __brand: 'NoteId' };

/**
 * Path to the vault directory
 *
 * This is a branded type to prevent accidental mixing with other string types.
 * Use createVaultPath() to create instances.
 */
export type VaultPath = string & { readonly __brand: 'VaultPath' };

/**
 * Create a NoteId from a string
 *
 * Use this function to convert raw strings to the NoteId type.
 * The function performs no validation - it simply brands the string.
 *
 * @param id - The raw string identifier to brand as a NoteId
 * @returns A branded NoteId that can be used throughout the application
 *
 * @example
 * ```typescript
 * const id = createNoteId('abc-123');
 * // id is now typed as NoteId, preventing accidental mixing with other strings
 * ```
 *
 * @since 1.0.0
 */
export function createNoteId(id: string): NoteId {
  return id as NoteId;
}

/**
 * Create a VaultPath from a string
 *
 * Use this function to convert raw strings to the VaultPath type.
 * The function performs no validation - it simply brands the string.
 *
 * @param path - The raw string path to brand as a VaultPath
 * @returns A branded VaultPath that can be used for vault operations
 *
 * @example
 * ```typescript
 * const vaultPath = createVaultPath('/Users/name/Documents/my-vault');
 * // vaultPath is now typed as VaultPath
 * ```
 *
 * @since 1.0.0
 */
export function createVaultPath(path: string): VaultPath {
  return path as VaultPath;
}

/**
 * Note type discriminator
 * Used to distinguish special note types from regular notes.
 *
 * Current types:
 * - 'person': A person entity that can be mentioned with @name syntax
 * - undefined: A regular note (default)
 *
 * Future types to consider:
 * - 'project': A project note for organizing related work
 * - 'meeting': A meeting note with date/attendees
 * - 'daily': A daily journal note
 * - 'template': A template for creating new notes
 *
 * To add a new type:
 * 1. Add the string literal to this union type
 * 2. Update metadata extraction in packages/engine-core/src/metadata.ts
 * 3. Update the graph engine if the type has special relationships
 * 4. Add any UI components for the new type
 */
export type NoteType = 'person' | 'project' | 'meeting' | 'daily' | 'template' | 'system';

// ============================================================================
// Editor Content Abstraction Layer
// ============================================================================
// These types provide an abstract representation of rich text content that is
// editor-agnostic. The current implementation uses Lexical's JSON format, but
// these abstractions allow the application to be decoupled from specific editor
// implementations and enable future editor migrations.
// ============================================================================

/**
 * Abstract node in the editor content tree
 *
 * This interface represents a generic node in the content structure.
 * While the current implementation uses Lexical's JSON format, this
 * abstraction allows the content structure to be treated generically.
 *
 * Known node types include:
 * - 'root': Root container node
 * - 'paragraph': Text paragraph
 * - 'text': Text content
 * - 'heading': Header element
 * - 'list': List container (ordered/unordered)
 * - 'listitem': List item
 * - 'link': Hyperlink
 * - 'wiki-link': Internal note link
 * - 'person-mention': Person reference (@mention)
 * - 'table': Table container
 * - 'checklist': Checklist/task list
 */
export interface EditorNode {
  /** Node type identifier */
  type: string;
  /** Schema version for this node type */
  version?: number;
  /** Child nodes (for container nodes) */
  children?: EditorNode[];
  /** Additional node-specific properties */
  [key: string]: unknown;
}

/**
 * Abstract editor content structure
 *
 * This is the canonical representation of note content, designed to be
 * editor-agnostic. The structure follows a tree format with a root node
 * containing child nodes.
 *
 * Current implementation: Lexical JSON format (v1)
 * Future support could include: ProseMirror, Slate, or custom formats
 *
 * @example
 * const content: EditorContent = {
 *   root: {
 *     type: 'root',
 *     children: [
 *       { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] }
 *     ]
 *   }
 * };
 */
export interface EditorContent {
  /** Root node containing the content tree */
  root: {
    type: 'root';
    children: EditorNode[];
    format?: string | number;
    indent?: number;
    version?: number;
  };
  /**
   * Optional note type discriminator stored at the content root level.
   * Used to distinguish special note types (e.g., 'person') from regular notes.
   * undefined = regular note
   */
  type?: NoteType;
}

// ============================================================================
// Lexical Compatibility Aliases (Deprecated)
// ============================================================================
// These type aliases are maintained for backward compatibility with existing
// code that references the Lexical-specific type names. New code should use
// EditorContent and EditorNode instead.
// ============================================================================

/**
 * @deprecated Use EditorContent instead. This alias is maintained for backward compatibility.
 *
 * Lexical editor state serialized as JSON.
 * This is an alias for EditorContent to support existing code.
 */
export type LexicalState = EditorContent;

/**
 * @deprecated Use EditorNode instead. This alias is maintained for backward compatibility.
 *
 * Generic Lexical node structure.
 * This is an alias for EditorNode to support existing code.
 */
export type LexicalNode = EditorNode;

/**
 * Metadata derived from note content
 * This is always extracted by the engine, never set directly by the UI
 */
export interface NoteMetadata {
  /**
   * @deprecated Use Note.title instead. This field is derived from content
   * for backward compatibility with legacy notes only and will always be null
   * for new notes.
   */
  title: string | null;

  /**
   * Tags extracted from content using #tag conventions or custom nodes
   */
  tags: string[];

  /**
   * Outbound references to other notes (extracted from link nodes)
   */
  links: NoteId[];

  /**
   * People mentioned in this note (extracted from person-mention nodes)
   * Each entry is the NoteId of a person note
   */
  mentions: NoteId[];

  /**
   * Note type discriminator
   * - 'person': A person entity that can be mentioned with @name syntax
   * - undefined: A regular note (default)
   */
  type?: NoteType;
}

/**
 * System note IDs
 *
 * Reserved IDs for special system-level notes that render custom screens
 * instead of the standard note editor. These notes don't have content files
 * in the vault - they are virtual notes handled specially by the UI.
 *
 * @example
 * ```typescript
 * // Navigate to the tasks screen
 * navigateToNote(SYSTEM_NOTE_IDS.TASKS);
 * ```
 *
 * @since 1.0.0
 */
export const SYSTEM_NOTE_IDS = {
  /** Virtual note ID for the Tasks management screen */
  TASKS: 'system:tasks',
} as const;

/**
 * Check if a note ID is a system note
 *
 * System notes are identified by the 'system:' prefix and represent
 * virtual screens rather than actual note content.
 *
 * @param id - The note ID to check (can be null/undefined for safety)
 * @returns `true` if the ID represents a system note, `false` otherwise
 *
 * @example
 * ```typescript
 * isSystemNoteId('system:tasks');  // true
 * isSystemNoteId('abc-123');        // false
 * isSystemNoteId(null);             // false
 * ```
 *
 * @since 1.0.0
 */
export function isSystemNoteId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id.startsWith('system:');
}

// ============================================================================
// Note Type Discriminated Union
// ============================================================================
// Notes use a discriminated union pattern to provide type-safe access to
// type-specific data. The `type` field is the discriminant, and type guards
// can be used to narrow the Note type.
// ============================================================================

/**
 * Daily note specific data
 *
 * Contains the date-specific metadata for daily journal notes.
 * This data is stored in the `daily` field of DailyNote.
 *
 * @example
 * ```typescript
 * const dailyData: DailyNoteData = {
 *   date: '2024-01-15'
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface DailyNoteData {
  /**
   * ISO date string in "YYYY-MM-DD" format.
   * Used to associate the note with a specific calendar date.
   */
  date: string;
}

/**
 * Meeting note specific data
 *
 * Contains metadata specific to meeting notes, including the date,
 * linked daily note, and attendee references.
 *
 * @example
 * ```typescript
 * const meetingData: MeetingNoteData = {
 *   date: '2024-01-15',
 *   dailyNoteId: createNoteId('daily-2024-01-15'),
 *   attendees: [
 *     createNoteId('person-alice'),
 *     createNoteId('person-bob')
 *   ]
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface MeetingNoteData {
  /**
   * ISO date string in "YYYY-MM-DD" format.
   * The date when the meeting occurred.
   */
  date: string;
  /**
   * Reference to the daily note for this meeting's date.
   * Creates a bidirectional link between meeting and daily notes.
   */
  dailyNoteId: NoteId;
  /**
   * List of person note IDs representing meeting attendees.
   * Each ID references a PersonNote in the vault.
   */
  attendees: NoteId[];
}

/**
 * Base note structure containing fields common to all note types.
 * This is combined with type-specific discriminated union variants.
 */
export interface BaseNote {
  /**
   * Immutable unique identifier
   */
  id: NoteId;

  /**
   * User-editable title for the note
   * This is the canonical title displayed in sidebar, search, etc.
   * Unlike metadata.title which is derived from content, this is explicitly set by the user.
   */
  title: string;

  /**
   * Timestamp when note was created (milliseconds)
   */
  createdAt: number;

  /**
   * Timestamp when note was last updated (milliseconds)
   * Managed by engine only
   */
  updatedAt: number;

  /**
   * User-defined tags for the note
   * These are explicitly set by the user via the header UI.
   * Separate from metadata.tags which are extracted from inline #tag patterns in content.
   * Both are merged when displaying "all tags" for a note.
   */
  tags: string[];

  /**
   * Rich text content in abstract editor format
   * Currently uses Lexical JSON format internally
   */
  content: EditorContent;

  /**
   * Derived metadata (title, tags, links)
   * Always re-extracted from content by engine
   * Note: metadata.title and metadata.tags are derived from content,
   * while note.title and note.tags are user-editable explicit fields.
   */
  metadata: NoteMetadata;
}

/**
 * Regular note (no special type)
 *
 * The default note type with no special behavior or metadata.
 * Most notes in a vault are regular notes.
 *
 * @since 1.0.0
 */
export interface RegularNote extends BaseNote {
  /** Explicitly undefined to mark as regular note in discriminated union */
  type?: undefined;
}

/**
 * Person note - a person entity that can be mentioned with @name syntax
 *
 * Person notes represent people in your network. They can be mentioned
 * in other notes using @name syntax, which creates a link and adds the
 * person to that note's mentions metadata.
 *
 * @example
 * ```typescript
 * // In another note's content, type "@Alice" to mention this person
 * ```
 *
 * @since 1.0.0
 */
export interface PersonNote extends BaseNote {
  /** Discriminant for person notes */
  type: 'person';
}

/**
 * Project note - for organizing related work
 *
 * Project notes serve as organizational hubs for grouping related notes.
 * They can be linked from other notes to establish project membership.
 *
 * @since 1.0.0
 */
export interface ProjectNote extends BaseNote {
  /** Discriminant for project notes */
  type: 'project';
}

/**
 * Template note - a template for creating new notes
 *
 * Template notes contain predefined structure that can be used as a
 * starting point when creating new notes. The template's content is
 * copied to the new note.
 *
 * @since 1.0.0
 */
export interface TemplateNote extends BaseNote {
  /** Discriminant for template notes */
  type: 'template';
}

/**
 * System note - reserved for special system-level functionality
 *
 * System notes are virtual notes that don't have content files.
 * They represent special screens or functionality in the app.
 *
 * @see SYSTEM_NOTE_IDS for predefined system note identifiers
 * @since 1.0.0
 */
export interface SystemNote extends BaseNote {
  /** Discriminant for system notes */
  type: 'system';
}

/**
 * Daily note - a daily journal note with date-specific data
 *
 * Daily notes are journal entries tied to a specific calendar date.
 * They include additional metadata in the `daily` field.
 *
 * @example
 * ```typescript
 * if (isDailyNote(note)) {
 *   console.log(`Journal for ${note.daily.date}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export interface DailyNote extends BaseNote {
  /** Discriminant for daily notes */
  type: 'daily';
  /** Date-specific metadata for this daily note */
  daily: DailyNoteData;
}

/**
 * Meeting note - a meeting note with attendees and daily note link
 *
 * Meeting notes capture meeting information including date, attendees,
 * and a link to the associated daily note. They include additional
 * metadata in the `meeting` field.
 *
 * @example
 * ```typescript
 * if (isMeetingNote(note)) {
 *   console.log(`Meeting on ${note.meeting.date}`);
 *   console.log(`Attendees: ${note.meeting.attendees.length}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export interface MeetingNote extends BaseNote {
  /** Discriminant for meeting notes */
  type: 'meeting';
  /** Meeting-specific metadata including date and attendees */
  meeting: MeetingNoteData;
}

/**
 * Complete note structure using discriminated union.
 * This is the single source of truth for note data.
 *
 * The union uses `type` as the discriminant:
 * - Regular notes: type is undefined
 * - Person notes: type === 'person'
 * - Project notes: type === 'project'
 * - Template notes: type === 'template'
 * - System notes: type === 'system'
 * - Daily notes: type === 'daily', includes `daily` field
 * - Meeting notes: type === 'meeting', includes `meeting` field
 *
 * Use type guards (isDailyNote, isMeetingNote, etc.) to narrow the type
 * and access type-specific fields with full type safety.
 */
export type Note =
  | RegularNote
  | PersonNote
  | ProjectNote
  | TemplateNote
  | SystemNote
  | DailyNote
  | MeetingNote;

// ============================================================================
// Note Type Guards
// ============================================================================
// These type guards narrow the Note type based on the discriminant field.
// Use them to safely access type-specific data.
// ============================================================================

/**
 * Type guard for regular notes (no special type)
 *
 * Regular notes are the default note type with no special behavior or data.
 *
 * @param note - The note to check
 * @returns `true` if the note is a regular note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isRegularNote(note)) {
 *   // note is now typed as RegularNote
 *   console.log('This is a standard note');
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isRegularNote(note: Note): note is RegularNote {
  return note.type === undefined;
}

/**
 * Type guard for person notes
 *
 * Person notes represent people who can be mentioned in other notes using @name syntax.
 *
 * @param note - The note to check
 * @returns `true` if the note is a person note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isPersonNote(note)) {
 *   // note is now typed as PersonNote
 *   console.log(`Person: ${note.title}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isPersonNote(note: Note): note is PersonNote {
  return note.type === 'person';
}

/**
 * Type guard for project notes
 *
 * Project notes are used for organizing related work and grouping notes.
 *
 * @param note - The note to check
 * @returns `true` if the note is a project note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isProjectNote(note)) {
 *   // note is now typed as ProjectNote
 *   console.log(`Project: ${note.title}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isProjectNote(note: Note): note is ProjectNote {
  return note.type === 'project';
}

/**
 * Type guard for template notes
 *
 * Template notes serve as templates for creating new notes with predefined structure.
 *
 * @param note - The note to check
 * @returns `true` if the note is a template note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isTemplateNote(note)) {
 *   // note is now typed as TemplateNote
 *   // Use this template to create a new note
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isTemplateNote(note: Note): note is TemplateNote {
  return note.type === 'template';
}

/**
 * Type guard for system notes
 *
 * System notes are reserved for special system-level functionality.
 * They typically don't have user-editable content.
 *
 * @param note - The note to check
 * @returns `true` if the note is a system note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isSystemNote(note)) {
 *   // note is now typed as SystemNote
 *   // Handle system-specific behavior
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isSystemNote(note: Note): note is SystemNote {
  return note.type === 'system';
}

/**
 * Type guard for daily notes
 *
 * Daily notes are journal entries tied to a specific date, with additional
 * date-related metadata in the `daily` field.
 *
 * @param note - The note to check
 * @returns `true` if the note is a daily note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isDailyNote(note)) {
 *   // note is now typed as DailyNote
 *   console.log(`Daily note for: ${note.daily.date}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isDailyNote(note: Note): note is DailyNote {
  return note.type === 'daily';
}

/**
 * Type guard for meeting notes
 *
 * Meeting notes are tied to a specific date and daily note, with attendee information
 * in the `meeting` field.
 *
 * @param note - The note to check
 * @returns `true` if the note is a meeting note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isMeetingNote(note)) {
 *   // note is now typed as MeetingNote
 *   console.log(`Meeting attendees: ${note.meeting.attendees.length}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isMeetingNote(note: Note): note is MeetingNote {
  return note.type === 'meeting';
}

/**
 * Graph node representation
 *
 * Represents a note as a node in the knowledge graph. Used by the graph
 * visualization engine to render the relationship network between notes.
 *
 * @example
 * ```typescript
 * const node: GraphNode = {
 *   id: createNoteId('abc-123'),
 *   title: 'Project Planning',
 *   tags: ['project', 'planning'],
 *   type: 'project'
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface GraphNode {
  /** Unique identifier for this node (references a Note) */
  id: NoteId;
  /**
   * Display title for the node. Can be `null` for untitled notes
   * or when the note hasn't been loaded yet.
   */
  title: string | null;
  /**
   * Combined tags from both explicit note.tags and extracted metadata.tags.
   * Used for filtering and grouping in graph views.
   */
  tags: string[];
  /**
   * Note type discriminator for filtering in graph views
   * - 'person': A person entity (rendered with special styling)
   * - 'project': A project note (may be rendered as a cluster)
   * - undefined: A regular note (default styling)
   */
  type?: NoteType;
}

/**
 * Graph edge representation
 *
 * Represents a connection between two notes in the knowledge graph.
 * Edges can represent different types of relationships.
 *
 * @example
 * ```typescript
 * // A wiki-link from note A to note B
 * const linkEdge: GraphEdge = {
 *   from: createNoteId('note-a'),
 *   to: createNoteId('note-b'),
 *   type: 'link'
 * };
 *
 * // A shared tag connection (both notes have #project tag)
 * const tagEdge: GraphEdge = {
 *   from: createNoteId('note-a'),
 *   to: createNoteId('note-c'),
 *   type: 'tag'
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface GraphEdge {
  /** Source node ID (the note containing the link or tag) */
  from: NoteId;
  /** Target node ID (the linked note or note sharing the tag) */
  to: NoteId;
  /**
   * Type of relationship:
   * - 'link': Direct wiki-link or person mention from source to target
   * - 'tag': Implicit connection via shared tag (both notes have same tag)
   */
  type: 'link' | 'tag';
}

/**
 * Search result
 *
 * Represents a single result from a full-text search query. Contains
 * the matched note's information along with relevance scoring and
 * match position data for highlighting.
 *
 * @example
 * ```typescript
 * const result: SearchResult = {
 *   id: createNoteId('abc-123'),
 *   title: 'Meeting Notes',
 *   snippet: '...discussed the **project** timeline and deliverables...',
 *   score: 0.85,
 *   matches: [
 *     { field: 'content', positions: [42, 156] }
 *   ]
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface SearchResult {
  /** Unique identifier of the matched note */
  id: NoteId;
  /**
   * Title of the matched note. Can be `null` for untitled notes.
   * Used for display in search results list.
   */
  title: string | null;
  /**
   * Contextual text snippet showing where matches occurred.
   * Typically 100-200 characters with ellipsis for context.
   * Match terms may be wrapped with markers for highlighting.
   */
  snippet: string;
  /**
   * Relevance score from the search engine.
   * Range: 0.0 to 1.0, where 1.0 is a perfect match.
   * Used for sorting results by relevance.
   */
  score: number;
  /**
   * Detailed match information for each field that matched.
   * Used for highlighting matches in the UI.
   */
  matches: Array<{
    /** Which field contained the match */
    field: 'title' | 'tags' | 'content';
    /**
     * Character positions where matches occurred within the field.
     * Each position is the start index of a match term.
     */
    positions: number[];
  }>;
}

/**
 * Vault configuration
 *
 * Configuration settings for a vault (the directory containing all notes).
 * Stored in the vault's configuration file and used for initialization.
 *
 * @example
 * ```typescript
 * const config: VaultConfig = {
 *   path: createVaultPath('/Users/name/Documents/my-vault'),
 *   version: '1.0.0'
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface VaultConfig {
  /** Absolute path to the vault directory */
  path: VaultPath;
  /**
   * Schema version for the vault format.
   * Used for migration when vault format changes.
   */
  version: string;
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Composite identifier for a task
 *
 * Tasks are identified by a combination of:
 * - noteId: The source document containing the task
 * - nodeKey: Lexical node key for the checklist item (primary anchor)
 * - textHash: SHA-256 hash of task text (first 16 chars) for fallback matching
 *
 * Serialized as: "{noteId}:{nodeKey}:{textHash}"
 * Example: "abc123:node_1a2b:a1b2c3d4e5f6a7b8"
 */
export interface TaskId {
  noteId: NoteId;
  nodeKey: string;
  textHash: string;
}

/**
 * Serialize a TaskId to its string representation
 *
 * Converts a structured TaskId object into a colon-separated string
 * suitable for storage, IPC, and use as a unique key.
 *
 * @param taskId - The TaskId object to serialize
 * @returns A string in the format "{noteId}:{nodeKey}:{textHash}"
 *
 * @example
 * ```typescript
 * const taskId: TaskId = {
 *   noteId: createNoteId('abc123'),
 *   nodeKey: 'node_1a2b',
 *   textHash: 'a1b2c3d4e5f6a7b8'
 * };
 * const serialized = serializeTaskId(taskId);
 * // Result: "abc123:node_1a2b:a1b2c3d4e5f6a7b8"
 * ```
 *
 * @see parseTaskId for the inverse operation
 * @since 1.0.0
 */
export function serializeTaskId(taskId: TaskId): string {
  return `${taskId.noteId}:${taskId.nodeKey}:${taskId.textHash}`;
}

/**
 * Parse a serialized TaskId string back to a TaskId object
 *
 * Converts a colon-separated string back into a structured TaskId object.
 * Validates the format but does not validate the individual components.
 *
 * @param id - The serialized TaskId string to parse
 * @returns A TaskId object if the format is valid, or `null` if invalid
 *
 * @example
 * ```typescript
 * const taskId = parseTaskId('abc123:node_1a2b:a1b2c3d4e5f6a7b8');
 * if (taskId) {
 *   console.log(taskId.noteId);   // 'abc123' as NoteId
 *   console.log(taskId.nodeKey);  // 'node_1a2b'
 *   console.log(taskId.textHash); // 'a1b2c3d4e5f6a7b8'
 * }
 *
 * parseTaskId('invalid');  // Returns null
 * parseTaskId('a:b');      // Returns null (wrong number of parts)
 * ```
 *
 * @see serializeTaskId for the inverse operation
 * @since 1.0.0
 */
export function parseTaskId(id: string): TaskId | null {
  const parts = id.split(':');
  if (parts.length !== 3) {
    return null;
  }
  const [noteIdStr, nodeKey, textHash] = parts;
  if (!noteIdStr || !nodeKey || !textHash) {
    return null;
  }
  return { noteId: createNoteId(noteIdStr), nodeKey, textHash };
}

/**
 * A task extracted from a note's checklist items
 *
 * Tasks use a hybrid storage model:
 * - Source of truth: Markdown checkboxes in Lexical content
 * - Index for fast queries: TaskIndex stored in-memory and persisted to JSONL
 */
export interface Task {
  /**
   * Serialized TaskId: "{noteId}:{nodeKey}:{textHash}"
   */
  id: string;

  /**
   * Source document ID containing this task
   */
  noteId: NoteId;

  /**
   * Source document title (denormalized for display)
   */
  noteTitle: string;

  /**
   * Lexical node key for the checklist item (primary anchor for navigation)
   */
  nodeKey: string;

  /**
   * List item block ordinal (best-effort, recomputed on extraction)
   * Used for fallback navigation when nodeKey cannot be found
   */
  lineIndex: number;

  /**
   * Task text content (without checkbox syntax)
   */
  text: string;

  /**
   * SHA-256 hash of task text (first 16 hex chars)
   * Used for identity matching when nodeKey changes (e.g., after paste/import)
   */
  textHash: string;

  /**
   * Current completion state (derived from source checkbox)
   */
  completed: boolean;

  /**
   * Timestamp when task was last completed (undefined if never completed or unchecked)
   */
  completedAt?: number;

  /**
   * User-defined priority (0 = highest)
   * Managed via drag-and-drop reordering
   */
  priority: number;

  /**
   * Timestamp when task was first indexed
   */
  createdAt: number;

  /**
   * Timestamp when task was last reconciled with source
   */
  updatedAt: number;
}

/**
 * Filter options for querying tasks
 */
export interface TaskFilter {
  /**
   * Filter by completion status
   * - true: only completed tasks
   * - false: only incomplete tasks
   * - undefined: all tasks
   */
  completed?: boolean;

  /**
   * Filter by source note ID
   */
  noteId?: NoteId;

  /**
   * Filter by creation date (inclusive lower bound)
   */
  createdAfter?: number;

  /**
   * Filter by creation date (inclusive upper bound)
   */
  createdBefore?: number;

  /**
   * Filter by completion date (inclusive lower bound)
   * Only applies to completed tasks
   */
  completedAfter?: number;

  /**
   * Filter by completion date (inclusive upper bound)
   * Only applies to completed tasks
   */
  completedBefore?: number;

  /**
   * Sort field
   * - 'priority': User-defined priority order
   * - 'createdAt': Creation timestamp
   */
  sortBy?: 'priority' | 'createdAt';

  /**
   * Sort direction
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * Maximum number of tasks to return
   * Default: 100 for Tasks screen, 20 for panel
   */
  limit?: number;

  /**
   * Opaque cursor for pagination
   * Returned from previous query when more results are available
   */
  cursor?: string;
}

/**
 * Event emitted when tasks change
 *
 * Used for real-time sync between main process and renderer.
 * The Panel and Tasks Screen subscribe to the 'tasks:changed' IPC channel
 * and receive batched arrays of these events.
 *
 * Event types:
 * - `added`: A new task was extracted from a note's checklist
 * - `updated`: An existing task's content or completion state changed
 * - `removed`: A task was deleted (checkbox removed from source note)
 * - `reordered`: Task priorities were changed via drag-and-drop
 *
 * @example
 * ```typescript
 * // Handle task events in renderer
 * ipcRenderer.on('tasks:changed', (events: TaskChangeEvent[]) => {
 *   for (const event of events) {
 *     switch (event.type) {
 *       case 'added':
 *         addTaskToList(event.task);
 *         break;
 *       case 'updated':
 *         updateTaskInList(event.task);
 *         break;
 *       case 'removed':
 *         removeTaskFromList(event.taskId);
 *         break;
 *       case 'reordered':
 *         reorderTasks(event.taskIds);
 *         break;
 *     }
 *   }
 * });
 * ```
 *
 * @since 1.0.0
 */
export type TaskChangeEvent =
  | { type: 'added'; task: Task }
  | { type: 'updated'; task: Task }
  | { type: 'removed'; taskId: string }
  | { type: 'reordered'; taskIds: string[] };
