/**
 * ID generation utilities for entities.
 * 
 * These utilities create canonical, stable identifiers for all entity types
 * in the knowledge graph system. IDs must be:
 * - Stable across renames (path-based)
 * - Unique within their entity type
 * - Deterministic (same input always produces same ID)
 * - Cross-platform compatible
 */

import {
  normalizePath,
  normalizeHeading,
  normalizeTag,
  normalizePersonName,
  normalizeFolderPath,
} from './normalize.js';
import type {
  NoteId,
  PersonId,
  TagId,
  FolderId,
  HeadingId,
  EmbedId,
  NodeId,
  EntityType,
} from '@scribe/domain-model/primitives';

/**
 * Generate a NoteId from a file path.
 * 
 * NoteIds are derived from the normalized file path relative to vault root.
 * The path is used as-is without the "note:" prefix for simplicity.
 * 
 * @example
 * generateNoteId("notes/Plan.md") // "notes/Plan.md"
 * generateNoteId("people/Erik.md") // "people/Erik.md"
 */
export function generateNoteId(filePath: string): NoteId {
  return normalizePath(filePath);
}

/**
 * Generate a HeadingId from a note ID and heading text.
 * 
 * HeadingIds use the format: `${noteId}#${normalized-heading}`
 * The normalized heading follows GitHub-flavored markdown anchor conventions.
 * 
 * @example
 * generateHeadingId("notes/Plan.md", "Goals & Scope") // "notes/Plan.md#goals-scope"
 */
export function generateHeadingId(noteId: NoteId, headingText: string): HeadingId {
  const normalized = normalizeHeading(headingText);
  return `${noteId}#${normalized}`;
}

/**
 * Generate a PersonId from a person name.
 * 
 * PersonIds are derived from the person's canonical name (trimmed).
 * For person files in `people/`, this is typically the filename without extension.
 * 
 * @example
 * generatePersonId("Erik") // "Erik"
 * generatePersonId("John Doe") // "John Doe"
 */
export function generatePersonId(personName: string): PersonId {
  return normalizePersonName(personName);
}

/**
 * Generate a TagId from a tag name.
 * 
 * TagIds are normalized to lowercase, with leading # removed.
 * This ensures "#planning" and "planning" resolve to the same tag.
 * 
 * @example
 * generateTagId("#planning") // "planning"
 * generateTagId("Planning") // "planning"
 */
export function generateTagId(tagName: string): TagId {
  return normalizeTag(tagName);
}

/**
 * Generate a FolderId from a folder path.
 * 
 * FolderIds are the normalized folder path relative to vault root.
 * 
 * @example
 * generateFolderId("notes/2025") // "notes/2025"
 * generateFolderId("people") // "people"
 */
export function generateFolderId(folderPath: string): FolderId {
  return normalizeFolderPath(folderPath);
}

/**
 * Generate an EmbedId from source note ID and embed index.
 * 
 * EmbedIds uniquely identify an embed within a note.
 * The index represents the position of the embed in the note.
 * 
 * @example
 * generateEmbedId("notes/Plan.md", 0) // "embed:notes/Plan.md:0"
 */
export function generateEmbedId(sourceNoteId: NoteId, index: number): EmbedId {
  return `embed:${sourceNoteId}:${index}`;
}

/**
 * Generate a NodeId from an entity type and reference ID.
 * 
 * NodeIds are used in the graph system to uniquely identify nodes
 * across different entity types. The format is: `${entityType}:${refId}`
 * 
 * @example
 * generateNodeId("note", "notes/Plan.md") // "note:notes/Plan.md"
 * generateNodeId("person", "Erik") // "person:Erik"
 * generateNodeId("tag", "planning") // "tag:planning"
 */
export function generateNodeId(entityType: EntityType, refId: string): NodeId {
  return `${entityType}:${refId}`;
}

/**
 * Parse a NodeId to extract the entity type and reference ID.
 * 
 * @example
 * parseNodeId("note:notes/Plan.md") // { entityType: "note", refId: "notes/Plan.md" }
 * parseNodeId("person:Erik") // { entityType: "person", refId: "Erik" }
 */
export function parseNodeId(nodeId: NodeId): { entityType: EntityType; refId: string } | null {
  const colonIndex = nodeId.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }
  
  const entityType = nodeId.slice(0, colonIndex) as EntityType;
  const refId = nodeId.slice(colonIndex + 1);
  
  return { entityType, refId };
}

/**
 * Parse a HeadingId to extract the note ID and heading anchor.
 * 
 * @example
 * parseHeadingId("notes/Plan.md#goals-scope") 
 * // { noteId: "notes/Plan.md", headingAnchor: "goals-scope" }
 */
export function parseHeadingId(
  headingId: HeadingId
): { noteId: NoteId; headingAnchor: string } | null {
  const hashIndex = headingId.indexOf('#');
  if (hashIndex === -1) {
    return null;
  }
  
  const noteId = headingId.slice(0, hashIndex);
  const headingAnchor = headingId.slice(hashIndex + 1);
  
  return { noteId, headingAnchor };
}
