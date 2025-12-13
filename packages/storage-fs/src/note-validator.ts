/**
 * Note validation utilities
 *
 * Provides validation for note structure with detailed error reporting.
 * Extracted from FileSystemVault for better separation of concerns.
 */

import type { Note } from '@scribe/shared';

/**
 * Result of validation with detailed errors
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Interface for note validation
 */
export interface INoteValidator {
  /**
   * Validate that an object is a valid Note structure
   *
   * @param note - Object to validate
   * @returns true if valid note structure
   */
  validate(note: unknown): note is Note;

  /**
   * Validate a note with detailed error reporting
   *
   * @param note - Object to validate
   * @returns Validation result with errors list
   */
  validateWithErrors(note: unknown): ValidationResult;
}

/**
 * Validates note structure according to the Note interface
 *
 * Handles validation for:
 * - Core required fields: id, createdAt, updatedAt, content, metadata
 * - Optional title (string if present)
 * - Optional tags (array of strings if present)
 * - Optional daily { date: string }
 * - Optional meeting { date, dailyNoteId, attendees[] }
 */
export class NoteValidator implements INoteValidator {
  /**
   * Validate that an object is a valid Note structure
   *
   * @param note - Object to validate
   * @returns true if valid note structure
   */
  validate(note: unknown): note is Note {
    const result = this.validateWithErrors(note);
    return result.valid;
  }

  /**
   * Validate a note with detailed error reporting
   *
   * @param note - Object to validate
   * @returns Validation result with errors list
   */
  validateWithErrors(note: unknown): ValidationResult {
    const errors: string[] = [];

    // Check if note is an object
    if (typeof note !== 'object' || note === null) {
      errors.push('Note must be a non-null object');
      return { valid: false, errors };
    }

    const n = note as Record<string, unknown>;

    // Validate core required fields
    this.validateCoreFields(n, errors);

    // Validate optional fields
    this.validateOptionalTitle(n, errors);
    this.validateOptionalTags(n, errors);
    this.validateOptionalDaily(n, errors);
    this.validateOptionalMeeting(n, errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate core required fields: id, createdAt, updatedAt, content, metadata
   */
  private validateCoreFields(n: Record<string, unknown>, errors: string[]): void {
    if (typeof n.id !== 'string') {
      errors.push('Field "id" must be a string');
    }

    if (typeof n.createdAt !== 'number') {
      errors.push('Field "createdAt" must be a number (timestamp)');
    }

    if (typeof n.updatedAt !== 'number') {
      errors.push('Field "updatedAt" must be a number (timestamp)');
    }

    if (typeof n.content !== 'object' || n.content === null) {
      errors.push('Field "content" must be a non-null object (LexicalState)');
    }

    if (typeof n.metadata !== 'object' || n.metadata === null) {
      errors.push('Field "metadata" must be a non-null object (NoteMetadata)');
    }
  }

  /**
   * Validate optional title field
   */
  private validateOptionalTitle(n: Record<string, unknown>, errors: string[]): void {
    if (n.title !== undefined && typeof n.title !== 'string') {
      errors.push('Field "title" must be a string if present');
    }
  }

  /**
   * Validate optional tags field
   */
  private validateOptionalTags(n: Record<string, unknown>, errors: string[]): void {
    if (n.tags !== undefined) {
      if (!Array.isArray(n.tags)) {
        errors.push('Field "tags" must be an array if present');
      } else if (!n.tags.every((tag) => typeof tag === 'string')) {
        errors.push('Field "tags" must contain only strings');
      }
    }
  }

  /**
   * Validate optional daily field
   */
  private validateOptionalDaily(n: Record<string, unknown>, errors: string[]): void {
    if (n.daily !== undefined) {
      if (typeof n.daily !== 'object' || n.daily === null) {
        errors.push('Field "daily" must be a non-null object if present');
        return;
      }

      const daily = n.daily as Record<string, unknown>;
      if (typeof daily.date !== 'string') {
        errors.push('Field "daily.date" must be a string (ISO date format YYYY-MM-DD)');
      }
    }
  }

  /**
   * Validate optional meeting field
   */
  private validateOptionalMeeting(n: Record<string, unknown>, errors: string[]): void {
    if (n.meeting !== undefined) {
      if (typeof n.meeting !== 'object' || n.meeting === null) {
        errors.push('Field "meeting" must be a non-null object if present');
        return;
      }

      const meeting = n.meeting as Record<string, unknown>;

      if (typeof meeting.date !== 'string') {
        errors.push('Field "meeting.date" must be a string (ISO date format YYYY-MM-DD)');
      }

      if (typeof meeting.dailyNoteId !== 'string') {
        errors.push('Field "meeting.dailyNoteId" must be a string (NoteId)');
      }

      if (!Array.isArray(meeting.attendees)) {
        errors.push('Field "meeting.attendees" must be an array of NoteIds');
      }
    }
  }
}

/**
 * Default validator instance for convenience
 */
export const noteValidator = new NoteValidator();
