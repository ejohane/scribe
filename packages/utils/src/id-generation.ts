/**
 * ID generation utilities for entities.
 */

import { normalizePath, normalizeHeading } from './normalize.js';

/**
 * Generate a NoteId from a file path.
 */
export function generateNoteId(filePath: string): string {
  return `note:${normalizePath(filePath)}`;
}

/**
 * Generate a HeadingId from a note ID and heading text.
 */
export function generateHeadingId(noteId: string, headingText: string): string {
  const normalized = normalizeHeading(headingText);
  return `${noteId}#${normalized}`;
}

/**
 * Generate a PersonId from a person name.
 */
export function generatePersonId(personName: string): string {
  return personName.trim();
}

/**
 * Generate a TagId from a tag name.
 */
export function generateTagId(tagName: string): string {
  return tagName.toLowerCase().trim().replace(/^#/, '');
}

/**
 * Generate a FolderId from a folder path.
 */
export function generateFolderId(folderPath: string): string {
  return normalizePath(folderPath);
}

/**
 * Generate an EmbedId.
 */
export function generateEmbedId(sourceNoteId: string, index: number): string {
  return `embed:${sourceNoteId}:${index}`;
}

/**
 * Generate a NodeId from an entity type and reference ID.
 */
export function generateNodeId(entityType: string, refId: string): string {
  return `${entityType}:${refId}`;
}
