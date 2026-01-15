/**
 * GraphService - Read-only graph queries for backlinks, forward links, and tags.
 *
 * This service provides graph navigation capabilities:
 * - Backlinks: "What references this note?"
 * - Forward links: "What does this note reference?"
 * - Tag navigation: Browse notes by tag
 * - Graph stats: Dashboard metrics
 *
 * GraphService is READ-ONLY. All mutations happen through DocumentService.
 *
 * @module
 */

import type { NotesRepository, LinksRepository, TagsRepository, NoteType } from '@scribe/server-db';

/**
 * Graph node representation for navigation.
 */
export interface GraphNode {
  /** Note ID */
  id: string;
  /** Note title */
  title: string;
  /** Note type */
  type: NoteType;
}

/**
 * Link information including display text.
 */
export interface LinkInfo extends GraphNode {
  /** Display text of the link (e.g., the text inside [[brackets]]) */
  linkText: string | null;
}

/**
 * Tag with usage count.
 */
export interface TagInfo {
  /** Tag name (normalized to lowercase) */
  name: string;
  /** Number of notes with this tag */
  count: number;
}

/**
 * Graph-wide statistics.
 */
export interface GraphStats {
  /** Total number of notes in the vault */
  totalNotes: number;
  /** Total number of links between notes */
  totalLinks: number;
  /** Total number of unique tags */
  totalTags: number;
  /** Notes with no links in or out */
  orphanedNotes: number;
}

/**
 * Dependencies for GraphService.
 */
export interface GraphServiceDeps {
  /** Notes repository for note lookups */
  notesRepo: NotesRepository;
  /** Links repository for graph queries */
  linksRepo: LinksRepository;
  /** Tags repository for tag queries */
  tagsRepo: TagsRepository;
}

/**
 * GraphService - Read-only graph queries for knowledge graph navigation.
 *
 * @example
 * ```typescript
 * const service = new GraphService({
 *   notesRepo: new NotesRepository(db),
 *   linksRepo: new LinksRepository(db),
 *   tagsRepo: new TagsRepository(db),
 * });
 *
 * // Get backlinks (notes that link TO this note)
 * const backlinks = service.getBacklinks(noteId);
 *
 * // Get forward links (notes this note links TO)
 * const forwardLinks = service.getForwardLinks(noteId);
 *
 * // Browse notes by tag
 * const taggedNotes = service.getNotesWithTag('typescript');
 *
 * // Get all tags with counts
 * const tags = service.getAllTags();
 * ```
 */
export class GraphService {
  private readonly notesRepo: NotesRepository;
  private readonly linksRepo: LinksRepository;
  private readonly tagsRepo: TagsRepository;

  constructor(deps: GraphServiceDeps) {
    this.notesRepo = deps.notesRepo;
    this.linksRepo = deps.linksRepo;
    this.tagsRepo = deps.tagsRepo;
  }

  /**
   * Get all notes that link TO this note (backlinks).
   *
   * Use case: "What references this note?" - critical for
   * knowledge graph navigation and discovering connections.
   *
   * @param noteId - The target note ID
   * @returns Array of linking notes with link text
   *
   * @example
   * ```typescript
   * const backlinks = graphService.getBacklinks(currentNoteId);
   * // Display: "3 notes link to this note"
   * // - "Project Ideas" (link text: "see also")
   * // - "Daily 2024-01-15" (link text: null)
   * ```
   */
  getBacklinks(noteId: string): LinkInfo[] {
    const links = this.linksRepo.findByTargetId(noteId);

    return links
      .map((link) => {
        const source = this.notesRepo.findById(link.sourceId);
        if (!source) {
          return null;
        }

        return {
          id: source.id,
          title: source.title,
          type: source.type,
          linkText: link.linkText,
        };
      })
      .filter((item): item is LinkInfo => item !== null);
  }

  /**
   * Get all notes that this note links TO (forward links / outlinks).
   *
   * Use case: "What does this note reference?" - for showing
   * a local graph or related notes panel.
   *
   * @param noteId - The source note ID
   * @returns Array of linked notes with link text
   *
   * @example
   * ```typescript
   * const links = graphService.getForwardLinks(noteId);
   * // Display mini-graph or list of linked notes
   * ```
   */
  getForwardLinks(noteId: string): LinkInfo[] {
    const links = this.linksRepo.findBySourceId(noteId);

    return links
      .map((link) => {
        const target = this.notesRepo.findById(link.targetId);
        if (!target) {
          return null;
        }

        return {
          id: target.id,
          title: target.title,
          type: target.type,
          linkText: link.linkText,
        };
      })
      .filter((item): item is LinkInfo => item !== null);
  }

  /**
   * Get all notes with a specific tag.
   *
   * Use case: Browse notes by topic/category.
   *
   * @param tagName - The tag name (case-insensitive)
   * @returns Array of notes with this tag
   *
   * @example
   * ```typescript
   * const projectNotes = graphService.getNotesWithTag('project');
   * // Display list of notes tagged #project
   * ```
   */
  getNotesWithTag(tagName: string): GraphNode[] {
    const notes = this.tagsRepo.findNotesByTagName(tagName);

    return notes.map((note) => ({
      id: note.id,
      title: note.title,
      type: note.type,
    }));
  }

  /**
   * Get all tags in the vault with usage counts.
   *
   * Use case: Tag cloud, autocomplete, navigation sidebar.
   *
   * @returns Array of tags with counts, ordered by count descending
   *
   * @example
   * ```typescript
   * const tags = graphService.getAllTags();
   * // Display: "Tags: #project (5), #meeting (3), #idea (2)"
   * ```
   */
  getAllTags(): TagInfo[] {
    const tags = this.tagsRepo.findAllWithCounts();

    return tags.map((tag) => ({
      name: tag.name,
      count: tag.count,
    }));
  }

  /**
   * Get tags for a specific note.
   *
   * @param noteId - The note ID
   * @returns Array of tag names
   *
   * @example
   * ```typescript
   * const tags = graphService.getNoteTags(noteId);
   * // ['typescript', 'project', 'todo']
   * ```
   */
  getNoteTags(noteId: string): string[] {
    const tags = this.tagsRepo.findByNoteId(noteId);
    return tags.map((t) => t.name);
  }

  /**
   * Get graph statistics.
   *
   * Use case: Dashboard, health monitoring, vault overview.
   *
   * @returns Graph-wide statistics
   *
   * @example
   * ```typescript
   * const stats = graphService.getStats();
   * // { totalNotes: 150, totalLinks: 450, totalTags: 25, orphanedNotes: 12 }
   * ```
   */
  getStats(): GraphStats {
    const allNotes = this.notesRepo.findAll();
    const totalNotes = allNotes.length;

    // Count all links by summing outlinks from each note
    // This is more reliable than trying to get all links at once
    let totalLinks = 0;
    const notesWithLinks = new Set<string>();

    for (const note of allNotes) {
      const outlinks = this.linksRepo.findBySourceId(note.id);
      const backlinks = this.linksRepo.findByTargetId(note.id);

      totalLinks += outlinks.length;

      if (outlinks.length > 0 || backlinks.length > 0) {
        notesWithLinks.add(note.id);
      }
    }

    const allTags = this.tagsRepo.findAllWithCounts();
    const orphanedNotes = totalNotes - notesWithLinks.size;

    return {
      totalNotes,
      totalLinks,
      totalTags: allTags.length,
      orphanedNotes,
    };
  }
}
