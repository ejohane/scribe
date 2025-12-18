/**
 * Notes Command Module
 *
 * Provides CLI commands for listing and querying notes in the vault.
 */

import * as fs from 'node:fs/promises';
import nodePath from 'node:path';
import { Command } from 'commander';
import type { Note, NoteType } from '@scribe/shared';
import { createNoteId, extractMarkdown } from '@scribe/shared';
import { initializeContext, type GlobalOptions } from '../context.js';
import { output } from '../output.js';
import { extractPlainText } from '../content-extractor.js';
import { noteNotFound } from '../errors.js';
import { resolveContentInput } from '../input.js';
import {
  appendParagraphToContent,
  appendTaskToContent,
  createInitialContent,
  createEmptyContent,
} from '../node-builder.js';

// ============================================================================
// Fuzzy Matching Utilities
// ============================================================================

/**
 * Calculate the Levenshtein distance between two strings.
 * This is the minimum number of single-character edits (insertions, deletions,
 * or substitutions) required to change one string into the other.
 *
 * @param a - First string
 * @param b - Second string
 * @returns The edit distance between the two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the DP table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate a fuzzy match score between a query and a title.
 * Returns a score from 0 to 1, where 1 is an exact match.
 *
 * The scoring algorithm:
 * 1. Exact match → 1.0
 * 2. Exact substring match → 0.9
 * 3. Fuzzy match based on Levenshtein distance → normalized score
 *
 * @param query - Search query (case-insensitive)
 * @param title - Note title (case-insensitive)
 * @returns Match score from 0 to 1
 */
function fuzzyMatchScore(query: string, title: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Exact match
  if (lowerTitle === lowerQuery) {
    return 1.0;
  }

  // Substring match - high score
  if (lowerTitle.includes(lowerQuery)) {
    // Score based on how much of the title is covered by the query
    return 0.9 * (lowerQuery.length / lowerTitle.length) + 0.1;
  }

  // Check if query words appear in title (multi-word matching)
  const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 0);
  if (queryWords.length > 1) {
    const matchingWords = queryWords.filter((word) => lowerTitle.includes(word));
    if (matchingWords.length === queryWords.length) {
      // All words found
      return 0.85;
    } else if (matchingWords.length > 0) {
      // Some words found
      return 0.5 * (matchingWords.length / queryWords.length);
    }
  }

  // Fuzzy match using Levenshtein distance
  // We compare query against each word in the title and take the best match
  const titleWords = lowerTitle.split(/\s+/).filter((w) => w.length > 0);
  let bestWordScore = 0;

  for (const titleWord of titleWords) {
    // Compare query to this title word
    const distance = levenshteinDistance(lowerQuery, titleWord);
    const maxLen = Math.max(lowerQuery.length, titleWord.length);

    if (maxLen > 0) {
      const wordScore = 1 - distance / maxLen;
      bestWordScore = Math.max(bestWordScore, wordScore);
    }
  }

  // Also compare full strings for longer queries
  const fullDistance = levenshteinDistance(lowerQuery, lowerTitle);
  const maxFullLen = Math.max(lowerQuery.length, lowerTitle.length);
  const fullScore = maxFullLen > 0 ? 1 - fullDistance / maxFullLen : 0;

  // Take the better of word-level or full-string matching
  const fuzzyScore = Math.max(bestWordScore * 0.7, fullScore * 0.6);

  return fuzzyScore;
}

/**
 * Check if title contains query as exact substring (case-insensitive)
 */
function exactSubstringMatch(query: string, title: string): boolean {
  return title.toLowerCase().includes(query.toLowerCase());
}

/**
 * Note type filter values
 * Matches NoteType from @scribe/shared but includes 'regular' for undefined types
 */
type NoteTypeFilter =
  | 'regular'
  | 'person'
  | 'project'
  | 'meeting'
  | 'daily'
  | 'template'
  | 'system';

/**
 * Sort field options for notes list
 */
type SortField = 'created' | 'updated' | 'title';

/**
 * Sort order options
 */
type SortOrder = 'asc' | 'desc';

/**
 * Options for the notes list command
 */
interface NotesListOptions {
  limit: string;
  offset: string;
  type?: NoteTypeFilter;
  tag?: string;
  since?: string;
  until?: string;
  sort: SortField;
  order: SortOrder;
}

/**
 * Format a note for list output (subset of fields)
 */
function formatNoteForList(note: Note) {
  return {
    id: note.id,
    title: note.title,
    type: note.type ?? 'regular',
    tags: note.tags || [],
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
    linkCount: note.metadata?.links?.length || 0,
  };
}

/**
 * Get a sort function based on field and order
 */
function getSortFunction(field: SortField, order: SortOrder) {
  const multiplier = order === 'asc' ? 1 : -1;
  return (a: Note, b: Note): number => {
    switch (field) {
      case 'title':
        return multiplier * a.title.localeCompare(b.title);
      case 'created':
        return multiplier * (a.createdAt - b.createdAt);
      case 'updated':
      default:
        return multiplier * (a.updatedAt - b.updatedAt);
    }
  };
}

/**
 * Parse a date string into a timestamp
 * Supports ISO dates and common formats
 */
function parseDate(dateStr: string): number {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return parsed.getTime();
}

/**
 * Register notes commands on the program
 */
export function registerNotesCommands(program: Command): void {
  // Get the existing notes command stub or create new
  let notes = program.commands.find((cmd) => cmd.name() === 'notes');

  if (!notes) {
    notes = program.command('notes').description('Note operations');
  }

  notes
    .command('list')
    .description('List all notes with optional filtering and pagination')
    .option('--limit <n>', 'Max results to return', '100')
    .option('--offset <n>', 'Skip first n results', '0')
    .option(
      '--type <type>',
      'Filter by note type (regular, person, project, meeting, daily, template, system)'
    )
    .option('--tag <tag>', 'Filter by tag (with or without #)')
    .option('--since <date>', 'Notes updated after date (ISO format)')
    .option('--until <date>', 'Notes updated before date (ISO format)')
    .option('--sort <field>', 'Sort by: created, updated, title', 'updated')
    .option('--order <order>', 'Sort order: asc, desc', 'desc')
    .action(async (options: NotesListOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      let notesList = ctx.vault.list();

      // Filter by type
      if (options.type) {
        if (options.type === 'regular') {
          // Regular notes have undefined type
          notesList = notesList.filter((n) => n.type === undefined);
        } else {
          notesList = notesList.filter((n) => n.type === options.type);
        }
      }

      // Filter by tag (normalize to include #)
      if (options.tag) {
        const tag = options.tag.startsWith('#') ? options.tag : `#${options.tag}`;
        notesList = notesList.filter((n) => {
          // Check both explicit tags and metadata-extracted tags
          const allTags = [...(n.tags || []), ...(n.metadata?.tags || [])];
          return allTags.some((t) => t === tag || t === options.tag);
        });
      }

      // Filter by date range (using updatedAt)
      if (options.since) {
        const sinceTs = parseDate(options.since);
        notesList = notesList.filter((n) => n.updatedAt >= sinceTs);
      }
      if (options.until) {
        const untilTs = parseDate(options.until);
        notesList = notesList.filter((n) => n.updatedAt <= untilTs);
      }

      // Sort
      const sortFn = getSortFunction(options.sort as SortField, options.order as SortOrder);
      notesList.sort(sortFn);

      // Capture total before pagination
      const total = notesList.length;

      // Pagination
      const limit = parseInt(options.limit, 10);
      const offset = parseInt(options.offset, 10);

      if (isNaN(limit) || limit < 0) {
        throw new Error('--limit must be a non-negative integer');
      }
      if (isNaN(offset) || offset < 0) {
        throw new Error('--offset must be a non-negative integer');
      }

      notesList = notesList.slice(offset, offset + limit);

      // Format output
      output(
        {
          notes: notesList.map(formatNoteForList),
          total,
          limit,
          offset,
        },
        globalOpts
      );
    });

  notes
    .command('show')
    .description('Get full note content and metadata')
    .argument('<id>', 'Note ID')
    .option('--include-raw', 'Include raw Lexical JSON')
    .action(async (id: string, options: { includeRaw?: boolean }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Extract plain text content
      const contentText = extractPlainText(note);

      // Get backlinks
      const backlinks = ctx.graphEngine.backlinks(createNoteId(id));

      // Get outlinks
      const outlinks = ctx.graphEngine.outlinks(createNoteId(id));

      output(
        {
          id: note.id,
          title: note.title,
          type: note.type,
          tags: note.tags || [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          content: {
            text: contentText,
            format: 'plain',
            ...(options.includeRaw && { raw: note.content }),
          },
          metadata: {
            links: outlinks.map((n) => ({ id: n.id, title: n.title })),
            backlinks: backlinks.map((n) => ({ id: n.id, title: n.title })),
          },
        },
        globalOpts
      );
    });

  notes
    .command('append')
    .description('Append text to a note')
    .argument('<id>', 'Note ID')
    .argument('<text>', 'Text to append (use - for stdin)')
    .option('--file <path>', 'Read content from file')
    .action(async (id: string, text: string, options: { file?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Get existing note
      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Resolve input
      const input = await resolveContentInput(text, options.file);

      // Append paragraph
      const updatedContent = appendParagraphToContent(note.content, input.text);

      // Save note
      await ctx.vault.save({ ...note, content: updatedContent });

      output(
        {
          success: true,
          note: {
            id: note.id,
            title: note.title,
            updatedAt: new Date().toISOString(),
          },
        },
        globalOpts
      );
    });

  notes
    .command('create')
    .description('Create a new note')
    .option('--title <title>', 'Note title', 'Untitled')
    .option('--type <type>', 'Note type: regular, person, meeting', 'regular')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--content <text>', 'Initial content')
    .action(async (options: { title: string; type: string; tags?: string; content?: string }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Parse tags
      const tags = options.tags
        ? options.tags
            .split(',')
            .map((t: string) => (t.trim().startsWith('#') ? t.trim() : `#${t.trim()}`))
        : [];

      // Create content
      const content = options.content
        ? createInitialContent(options.content)
        : createEmptyContent();

      // Map 'regular' type to undefined (regular notes have no type in the system)
      const noteType = options.type === 'regular' ? undefined : (options.type as NoteType);

      // Create note
      const note = await ctx.vault.create({
        title: options.title,
        type: noteType,
        tags,
        content,
      });

      output(
        {
          success: true,
          note: {
            id: note.id,
            title: note.title,
            type: note.type ?? 'regular',
            tags: note.tags || [],
            createdAt: new Date(note.createdAt).toISOString(),
            updatedAt: new Date(note.updatedAt).toISOString(),
          },
        },
        globalOpts
      );
    });

  notes
    .command('add-task')
    .description('Add a task to a note')
    .argument('<id>', 'Note ID')
    .argument('<text>', 'Task text')
    .action(async (id: string, text: string) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Append task
      const updatedContent = appendTaskToContent(note.content, text);

      // Save note
      await ctx.vault.save({ ...note, content: updatedContent });

      // Generate task ID (noteId:nodeKey:hash)
      const hash = text.slice(0, 8).replace(/\s/g, '');
      const taskId = `${id}:task:${hash}`;

      output(
        {
          success: true,
          task: {
            id: taskId,
            text,
            completed: false,
            noteId: id,
            noteTitle: note.title,
          },
        },
        globalOpts
      );
    });

  // ============================================================================
  // notes update - Update note metadata
  // ============================================================================

  /**
   * Valid note types for update command
   */
  const VALID_NOTE_TYPES = ['regular', 'person', 'meeting'] as const;
  type ValidNoteType = (typeof VALID_NOTE_TYPES)[number];

  /**
   * Options for the notes update command
   */
  interface NotesUpdateOptions {
    title?: string;
    type?: string;
    addTags?: string;
    removeTags?: string;
  }

  /**
   * Normalize a tag to ensure it starts with #
   */
  function normalizeTag(tag: string): string {
    const trimmed = tag.trim();
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }

  /**
   * Parse comma-separated tags and normalize them
   */
  function parseTags(tagsStr: string): string[] {
    return tagsStr
      .split(',')
      .map((t) => normalizeTag(t))
      .filter((t) => t.length > 1); // Filter out empty tags (just '#')
  }

  notes
    .command('update')
    .description('Update note metadata (title, type, tags)')
    .argument('<id>', 'Note ID')
    .option('--title <title>', 'New note title')
    .option('--type <type>', 'New note type (regular, person, meeting)')
    .option('--add-tags <tags>', 'Comma-separated tags to add')
    .option('--remove-tags <tags>', 'Comma-separated tags to remove')
    .action(async (id: string, options: NotesUpdateOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Validate that at least one option is provided
      if (!options.title && !options.type && !options.addTags && !options.removeTags) {
        throw new Error(
          'At least one option must be provided: --title, --type, --add-tags, or --remove-tags'
        );
      }

      // Validate type if provided
      if (options.type && !VALID_NOTE_TYPES.includes(options.type as ValidNoteType)) {
        throw new Error(
          `Invalid note type: ${options.type}. Valid types: ${VALID_NOTE_TYPES.join(', ')}`
        );
      }

      // Get existing note
      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Track changes for the response
      const changes: {
        title?: { from: string; to: string };
        type?: { from: string; to: string };
        tagsAdded: string[];
        tagsRemoved: string[];
      } = {
        tagsAdded: [],
        tagsRemoved: [],
      };

      // Apply title change
      let newTitle = note.title;
      if (options.title && options.title !== note.title) {
        changes.title = { from: note.title, to: options.title };
        newTitle = options.title;
      }

      // Apply type change
      let newType = note.type;
      if (options.type) {
        const oldType = note.type ?? 'regular';
        const targetType = options.type === 'regular' ? undefined : (options.type as NoteType);
        const newTypeStr = options.type;

        if (oldType !== newTypeStr) {
          changes.type = { from: oldType, to: newTypeStr };
          newType = targetType;
        }
      }

      // Apply tag changes
      let newTags = [...(note.tags || [])];

      // Add tags
      if (options.addTags) {
        const tagsToAdd = parseTags(options.addTags);
        for (const tag of tagsToAdd) {
          if (!newTags.includes(tag)) {
            newTags.push(tag);
            changes.tagsAdded.push(tag);
          }
        }
      }

      // Remove tags
      if (options.removeTags) {
        const tagsToRemove = parseTags(options.removeTags);
        for (const tag of tagsToRemove) {
          const index = newTags.indexOf(tag);
          if (index !== -1) {
            newTags.splice(index, 1);
            changes.tagsRemoved.push(tag);
          }
        }
      }

      // Only save if there are actual changes
      const hasChanges =
        changes.title ||
        changes.type ||
        changes.tagsAdded.length > 0 ||
        changes.tagsRemoved.length > 0;

      if (hasChanges) {
        // Save the updated note (preserving content)
        // The vault.save() method handles preserving type-specific fields (daily, meeting)
        // and building the proper discriminated union from the type field
        await ctx.vault.save({
          ...note,
          title: newTitle,
          type: newType,
          tags: newTags,
        } as Note);
      }

      const updatedAt = new Date().toISOString();

      output(
        {
          success: true,
          note: {
            id: note.id,
            title: newTitle,
            type: newType ?? 'regular',
            tags: newTags,
            updatedAt,
          },
          changes,
        },
        globalOpts
      );
    });

  // ============================================================================
  // notes find - Fuzzy title search
  // ============================================================================

  /**
   * Options for the notes find command
   */
  interface NotesFindOptions {
    limit: string;
    exact?: boolean;
  }

  notes
    .command('find')
    .description('Find notes by fuzzy title matching')
    .argument('<query>', 'Search query for title matching')
    .option('--limit <n>', 'Max results to return', '10')
    .option('--exact', 'Exact substring match only (no fuzzy matching)', false)
    .action(async (query: string, options: NotesFindOptions) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      const limit = parseInt(options.limit, 10);
      if (isNaN(limit) || limit < 1) {
        throw new Error('--limit must be a positive integer');
      }

      const notesList = ctx.vault.list();

      // Score and filter notes based on title matching
      interface ScoredNote {
        note: Note;
        score: number;
      }

      const scoredNotes: ScoredNote[] = [];

      for (const note of notesList) {
        if (options.exact) {
          // Exact substring match mode
          if (exactSubstringMatch(query, note.title)) {
            // For exact match, calculate a relevance score based on coverage
            const coverage = query.length / note.title.length;
            scoredNotes.push({ note, score: Math.min(1.0, 0.9 + coverage * 0.1) });
          }
        } else {
          // Fuzzy matching mode
          const score = fuzzyMatchScore(query, note.title);

          // Include results with a minimum threshold (filter out poor matches)
          const MIN_SCORE_THRESHOLD = 0.2;
          if (score >= MIN_SCORE_THRESHOLD) {
            scoredNotes.push({ note, score });
          }
        }
      }

      // Sort by score descending (most relevant first)
      scoredNotes.sort((a, b) => b.score - a.score);

      // Apply limit
      const results = scoredNotes.slice(0, limit).map(({ note, score }) => ({
        id: note.id,
        title: note.title,
        score: Math.round(score * 1000) / 1000, // Round to 3 decimal places
        type: note.type ?? 'regular',
      }));

      output(
        {
          results,
        },
        globalOpts
      );
    });

  // ============================================================================
  // notes delete - Delete a note with backlink protection
  // ============================================================================

  notes
    .command('delete')
    .description('Delete a note (with backlink protection)')
    .argument('<id>', 'Note ID to delete')
    .option('--force', 'Delete even if note has backlinks', false)
    .action(async (id: string, options: { force?: boolean }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Check if note exists
      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Get backlinks from GraphEngine
      const backlinks = ctx.graphEngine.backlinks(createNoteId(id));
      const backlinkCount = backlinks.length;

      // If backlinks exist and no --force, return error with backlink list
      if (backlinkCount > 0 && !options.force) {
        output(
          {
            success: false,
            error: 'Note has incoming links from other notes',
            code: 'HAS_BACKLINKS',
            noteId: id,
            backlinkCount,
            backlinks: backlinks.map((n) => ({ id: n.id, title: n.title })),
            hint: 'Use --force to delete anyway (backlinks will become broken)',
          },
          globalOpts
        );
        return;
      }

      // Delete the note
      await ctx.vault.delete(createNoteId(id));

      // Build success response
      const response: {
        success: boolean;
        deleted: { id: string; title: string };
        brokenBacklinks: number;
        warning?: string;
      } = {
        success: true,
        deleted: {
          id: note.id,
          title: note.title,
        },
        brokenBacklinks: backlinkCount,
      };

      // Add warning if backlinks were broken
      if (backlinkCount > 0) {
        response.warning = `${backlinkCount} notes now have broken links to this note`;
      }

      output(response, globalOpts);
    });

  // ============================================================================
  // notes export - Export a note to Markdown format
  // ============================================================================

  notes
    .command('export')
    .description('Export note to Markdown format')
    .argument('<id>', 'Note ID')
    .option('--output <path>', 'Output file path (defaults to stdout)')
    .option('--no-frontmatter', 'Exclude YAML frontmatter')
    .action(async (id: string, options: { output?: string; frontmatter: boolean }) => {
      const globalOpts = program.opts() as GlobalOptions;
      const ctx = await initializeContext(globalOpts);

      // Get note from vault (throws if not found)
      let note;
      try {
        note = ctx.vault.read(createNoteId(id));
      } catch {
        throw noteNotFound(id);
      }

      // Convert to Markdown
      const markdown = extractMarkdown(note, {
        includeFrontmatter: options.frontmatter,
      });

      if (options.output) {
        // Write to file
        const outputPath = nodePath.resolve(options.output);
        await fs.writeFile(outputPath, markdown, 'utf-8');

        output(
          {
            success: true,
            note: { id: note.id, title: note.title },
            outputPath,
          },
          globalOpts
        );
      } else {
        // Write to stdout (raw markdown)
        process.stdout.write(markdown);
      }
    });
}
