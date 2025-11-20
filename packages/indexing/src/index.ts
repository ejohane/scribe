/**
 * @scribe/indexing
 *
 * Indexing system for maintaining registries and indices of all entities.
 * Manages note registry, people index, tag index, folder index, etc.
 */

import { readFileSync, statSync } from 'fs';
import { NoteRegistry } from '@scribe/domain-model';
import type {
  AppState,
  ParsedNote,
  RawFile,
  FilePath,
  Folder,
  Tag,
  Heading,
  Person,
} from '@scribe/domain-model';
import { parseNote } from '@scribe/parser';
import type { Vault, VaultFile } from '@scribe/vault';

/**
 * Create an empty AppState with all indices initialized.
 */
export function createAppState(): AppState {
  return {
    noteRegistry: new NoteRegistry(),
    peopleIndex: {
      byId: new Map(),
      byName: new Map(),
      mentionsByPerson: new Map(),
      peopleByNote: new Map(),
    },
    tagIndex: {
      tags: new Map(),
      notesByTag: new Map(),
      tagsByNote: new Map(),
    },
    folderIndex: {
      folders: new Map(),
      childrenByFolder: new Map(),
      notesByFolder: new Map(),
    },
    headingIndex: {
      byId: new Map(),
      headingsByNote: new Map(),
    },
    embedIndex: {
      embedsBySourceNote: new Map(),
      embedsByTargetNote: new Map(),
    },
    graphIndex: {
      nodes: new Map(),
      outgoing: new Map(),
      incoming: new Map(),
    },
    unlinkedMentionIndex: {
      byNote: new Map(),
      byTarget: new Map(),
    },
  };
}

/**
 * Perform initial vault indexing at startup.
 *
 * This function:
 * 1. Discovers all .md files in the vault
 * 2. Parses each file in parallel
 * 3. Registers all ParsedNotes across indices
 * 4. Runs post-processing for resolution/unlinked mentions
 *
 * @param vault - Vault instance for file discovery
 * @param state - AppState to populate (should be empty)
 * @returns Promise that resolves when indexing is complete
 */
export async function performStartupIndexing(vault: Vault, state: AppState): Promise<void> {
  // Step 1: Discover all markdown files
  const discovery = vault.discover();
  const files = discovery.files;

  console.log(`[Indexing] Starting indexing of ${files.length} files...`);

  // Step 2: Parse all files in parallel
  const parsedNotes = await parseFilesInParallel(files);

  console.log(`[Indexing] Parsed ${parsedNotes.length} notes. Registering in indices...`);

  // Step 3: Register all parsed notes
  for (const parsed of parsedNotes) {
    registerParsedNote(state, parsed);
  }

  console.log(`[Indexing] Registration complete. Running post-processing...`);

  // Step 4: Post-processing (resolution and unlinked mentions)
  // TODO: Implement resolution pass when resolution package is ready
  // TODO: Implement unlinked mentions detection

  console.log(`[Indexing] Startup indexing complete. Indexed ${parsedNotes.length} notes.`);
}

/**
 * Parse multiple files in parallel.
 *
 * @param files - Array of vault files to parse
 * @returns Promise resolving to array of parsed notes
 */
async function parseFilesInParallel(files: VaultFile[]): Promise<ParsedNote[]> {
  // Parse files in parallel batches to avoid overwhelming the system
  const BATCH_SIZE = 50;
  const results: ParsedNote[] = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((file) => parseFileAsync(file));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Parse a single file asynchronously.
 *
 * @param file - Vault file to parse
 * @returns Promise resolving to parsed note
 */
async function parseFileAsync(file: VaultFile): Promise<ParsedNote> {
  return new Promise((resolve, reject) => {
    try {
      // Read file content
      const content = readFileSync(file.absolutePath, 'utf-8');
      const stats = statSync(file.absolutePath);

      // Create RawFile
      const rawFile: RawFile = {
        path: file.relativePath,
        content,
        lastModified: stats.mtimeMs,
      };

      // Parse note
      const parsed = parseNote(rawFile);

      resolve(parsed);
    } catch (error) {
      console.warn(`[Indexing] Failed to parse file ${file.relativePath}:`, error);
      // Don't reject - we want to continue indexing other files
      // Create a minimal ParsedNote as fallback
      resolve({
        id: file.id as any,
        path: file.relativePath,
        fileName: file.relativePath.split('/').pop() || '',
        resolvedTitle: file.relativePath.split('/').pop()?.replace(/\.md$/, '') || '',
        frontmatter: {},
        inlineTags: [],
        fmTags: [],
        allTags: [],
        aliases: [],
        headings: [],
        links: [],
        embeds: [],
        peopleMentions: [],
        plainText: '',
      });
    }
  });
}

/**
 * Register a parsed note in all indices.
 *
 * This is the core function for adding/updating a note across all data structures.
 *
 * @param state - AppState to update
 * @param parsed - ParsedNote to register
 */
export function registerParsedNote(state: AppState, parsed: ParsedNote): void {
  // 1. Register in note registry
  const existing = state.noteRegistry.getNoteById(parsed.id);
  if (existing) {
    state.noteRegistry.update(parsed);
  } else {
    state.noteRegistry.add(parsed);
  }

  // 2. Update folder index
  updateFolderIndex(state, parsed);

  // 3. Update tag index
  updateTagIndex(state, parsed);

  // 4. Update heading index
  updateHeadingIndex(state, parsed);

  // 5. Update people index
  updatePeopleIndex(state, parsed);

  // 6. Update embed index
  updateEmbedIndex(state, parsed);

  // 7. Graph edges will be added during post-processing resolution
  // TODO: Add basic graph nodes even before resolution
}

/**
 * Update folder index for a note.
 */
function updateFolderIndex(state: AppState, parsed: ParsedNote): void {
  // Extract folder from path
  const pathParts = parsed.path.split('/');
  if (pathParts.length > 1) {
    // Has a folder
    const folderParts = pathParts.slice(0, -1);
    const folderId = folderParts.join('/') as any;
    const folderPath = folderParts.join('/');

    // Track folder
    if (!state.folderIndex.folders.has(folderId)) {
      const folder: Folder = {
        id: folderId,
        name: folderParts[folderParts.length - 1],
        path: folderPath,
        parentId: folderParts.length > 1 ? (folderParts.slice(0, -1).join('/') as any) : undefined,
      };
      state.folderIndex.folders.set(folderId, folder);
    }

    // Track note in folder
    let notesInFolder = state.folderIndex.notesByFolder.get(folderId);
    if (!notesInFolder) {
      notesInFolder = new Set();
      state.folderIndex.notesByFolder.set(folderId, notesInFolder);
    }
    notesInFolder.add(parsed.id);
  }
}

/**
 * Update tag index for a note.
 */
function updateTagIndex(state: AppState, parsed: ParsedNote): void {
  // Remove old tags if note already exists
  const oldTags = state.tagIndex.tagsByNote.get(parsed.id);
  if (oldTags) {
    for (const tagId of oldTags) {
      const notesForTag = state.tagIndex.notesByTag.get(tagId);
      if (notesForTag) {
        notesForTag.delete(parsed.id);
        const tag = state.tagIndex.tags.get(tagId);
        if (tag) {
          tag.usageCount = Math.max(0, tag.usageCount - 1);
        }
        if (notesForTag.size === 0) {
          state.tagIndex.notesByTag.delete(tagId);
          state.tagIndex.tags.delete(tagId);
        }
      }
    }
  }

  // Add new tags
  const newTags = new Set(parsed.allTags);
  state.tagIndex.tagsByNote.set(parsed.id, newTags);

  for (const tagId of parsed.allTags) {
    // Track tag
    if (!state.tagIndex.tags.has(tagId)) {
      const tag: Tag = {
        id: tagId,
        name: tagId.replace('tag:', ''),
        usageCount: 0,
      };
      state.tagIndex.tags.set(tagId, tag);
    }

    // Increment usage count
    const tag = state.tagIndex.tags.get(tagId);
    if (tag) {
      tag.usageCount++;
    }

    // Track note in tag
    let notesForTag = state.tagIndex.notesByTag.get(tagId);
    if (!notesForTag) {
      notesForTag = new Set();
      state.tagIndex.notesByTag.set(tagId, notesForTag);
    }
    notesForTag.add(parsed.id);
  }
}

/**
 * Update heading index for a note.
 */
function updateHeadingIndex(state: AppState, parsed: ParsedNote): void {
  // Remove old headings
  const oldHeadings = state.headingIndex.headingsByNote.get(parsed.id);
  if (oldHeadings) {
    for (const headingId of oldHeadings) {
      state.headingIndex.byId.delete(headingId);
    }
  }

  // Add new headings
  const headingIds = parsed.headings.map((h) => h.id);
  state.headingIndex.headingsByNote.set(parsed.id, headingIds);

  for (const heading of parsed.headings) {
    const headingEntity: Heading = {
      id: heading.id,
      noteId: parsed.id,
      level: heading.level,
      text: heading.rawText,
      normalized: heading.normalized,
      line: heading.line,
    };
    state.headingIndex.byId.set(heading.id, headingEntity);
  }
}

/**
 * Update people index for a note.
 */
function updatePeopleIndex(state: AppState, parsed: ParsedNote): void {
  // Check if this is a person note (in people/ folder)
  const isPerson = parsed.path.startsWith('people/');

  if (isPerson) {
    // Register as a person entity
    const personId = parsed.id as any; // NoteId becomes PersonId for people
    const personName = parsed.resolvedTitle;

    const person: Person = {
      id: personId,
      noteId: parsed.id,
      path: parsed.path,
      name: personName,
      metadata: parsed.frontmatter,
    };

    state.peopleIndex.byId.set(personId, person);
    state.peopleIndex.byName.set(personName.toLowerCase(), personId);
  }

  // Remove old mentions
  const oldPeople = state.peopleIndex.peopleByNote.get(parsed.id);
  if (oldPeople) {
    for (const personId of oldPeople) {
      const mentions = state.peopleIndex.mentionsByPerson.get(personId);
      if (mentions) {
        mentions.delete(parsed.id);
        if (mentions.size === 0) {
          state.peopleIndex.mentionsByPerson.delete(personId);
        }
      }
    }
  }

  // Add new mentions
  const mentionedPeople = new Set<any>();
  for (const mention of parsed.peopleMentions) {
    // For now, create a temporary person ID based on the mention name
    // This will be properly resolved in the resolution pass
    const personName = mention.personName.toLowerCase();
    const personId = state.peopleIndex.byName.get(personName);

    if (personId) {
      mentionedPeople.add(personId);

      let notesForPerson = state.peopleIndex.mentionsByPerson.get(personId);
      if (!notesForPerson) {
        notesForPerson = new Set();
        state.peopleIndex.mentionsByPerson.set(personId, notesForPerson);
      }
      notesForPerson.add(parsed.id);
    }
  }

  if (mentionedPeople.size > 0) {
    state.peopleIndex.peopleByNote.set(parsed.id, mentionedPeople);
  }
}

/**
 * Update embed index for a note.
 */
function updateEmbedIndex(state: AppState, parsed: ParsedNote): void {
  // Remove old embeds from source index
  const oldEmbedIds = state.embedIndex.embedsBySourceNote.get(parsed.id);
  if (oldEmbedIds) {
    // Remove these embeds from target indices
    for (const [targetId, embedIds] of state.embedIndex.embedsByTargetNote.entries()) {
      const filtered = embedIds.filter((embedId) => !oldEmbedIds.includes(embedId));
      if (filtered.length === 0) {
        state.embedIndex.embedsByTargetNote.delete(targetId);
      } else if (filtered.length !== embedIds.length) {
        state.embedIndex.embedsByTargetNote.set(targetId, filtered);
      }
    }
  }

  // Add new embeds (will be resolved properly during resolution pass)
  // For now, we'll skip adding embeds to the index since proper resolution is needed
  // This will be handled in the resolution pass
  const embedIds: any[] = [];

  if (embedIds.length > 0) {
    state.embedIndex.embedsBySourceNote.set(parsed.id, embedIds);
  } else {
    state.embedIndex.embedsBySourceNote.delete(parsed.id);
  }
}

/**
 * Add or update a note in the index.
 */
export function indexNote(state: AppState, note: ParsedNote): void {
  registerParsedNote(state, note);
}

/**
 * Remove a note from the index.
 */
export function removeNote(state: AppState, noteId: string): void {
  // Check if note exists before trying to remove
  const note = state.noteRegistry.getNoteById(noteId);
  if (!note) {
    return; // Nothing to remove
  }

  // Remove from note registry
  state.noteRegistry.remove(noteId);

  // Remove from folder index
  for (const [folderId, notes] of state.folderIndex.notesByFolder) {
    notes.delete(noteId);
    if (notes.size === 0) {
      state.folderIndex.notesByFolder.delete(folderId);
    }
  }

  // Remove from tag index
  const tags = state.tagIndex.tagsByNote.get(noteId);
  if (tags) {
    for (const tagId of tags) {
      const notesForTag = state.tagIndex.notesByTag.get(tagId);
      if (notesForTag) {
        notesForTag.delete(noteId);
        if (notesForTag.size === 0) {
          state.tagIndex.notesByTag.delete(tagId);
          state.tagIndex.tags.delete(tagId);
        }
      }
    }
    state.tagIndex.tagsByNote.delete(noteId);
  }

  // Remove from heading index
  const headingIds = state.headingIndex.headingsByNote.get(noteId);
  if (headingIds) {
    for (const headingId of headingIds) {
      state.headingIndex.byId.delete(headingId);
    }
    state.headingIndex.headingsByNote.delete(noteId);
  }

  // Remove from people index
  const peopleInNote = state.peopleIndex.peopleByNote.get(noteId);
  if (peopleInNote) {
    for (const personId of peopleInNote) {
      const mentions = state.peopleIndex.mentionsByPerson.get(personId);
      if (mentions) {
        mentions.delete(noteId);
        if (mentions.size === 0) {
          state.peopleIndex.mentionsByPerson.delete(personId);
        }
      }
    }
    state.peopleIndex.peopleByNote.delete(noteId);
  }

  // If this was a person note, remove from people registry
  state.peopleIndex.byId.delete(noteId as any);

  // Remove from embed index
  const embedIds = state.embedIndex.embedsBySourceNote.get(noteId);
  if (embedIds) {
    // Remove from target indices
    for (const [targetId, targetEmbedIds] of state.embedIndex.embedsByTargetNote.entries()) {
      const filtered = targetEmbedIds.filter((embedId) => !embedIds.includes(embedId));
      if (filtered.length === 0) {
        state.embedIndex.embedsByTargetNote.delete(targetId);
      } else if (filtered.length !== targetEmbedIds.length) {
        state.embedIndex.embedsByTargetNote.set(targetId, filtered);
      }
    }
    state.embedIndex.embedsBySourceNote.delete(noteId);
  }

  // Remove from unlinked mentions
  state.unlinkedMentionIndex.byNote.delete(noteId);
  state.unlinkedMentionIndex.byTarget.delete(noteId);

  // TODO: Remove from graph index
}

export * from './types.js';
