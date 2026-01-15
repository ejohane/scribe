/**
 * Repository exports for @scribe/server-db
 *
 * Repositories provide type-safe data access patterns for each database table.
 */

export { NotesRepository, type NoteFilter } from './notes.repository.js';
export {
  LinksRepository,
  type LinkWithTargetTitle,
  type LinkWithSourceTitle,
} from './links.repository.js';
export { TagsRepository, type TagWithCount } from './tags.repository.js';
