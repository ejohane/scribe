/**
 * Tests for type utilities, type guards, and helper functions
 */

import { describe, it, expect } from 'vitest';
import {
  createNoteId,
  createVaultPath,
  serializeTaskId,
  parseTaskId,
  SYSTEM_NOTE_IDS,
  isSystemNoteId,
  isRegularNote,
  isPersonNote,
  isProjectNote,
  isTemplateNote,
  isSystemNote,
  isDailyNote,
  isMeetingNote,
} from './types.js';
import type {
  NoteId,
  VaultPath,
  TaskId,
  Note,
  RegularNote,
  PersonNote,
  ProjectNote,
  TemplateNote,
  SystemNote,
  DailyNote,
  MeetingNote,
  EditorContent,
  NoteMetadata,
} from './types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a minimal valid EditorContent for testing
 */
function createMinimalContent(): EditorContent {
  return {
    root: {
      type: 'root',
      children: [],
    },
  };
}

/**
 * Creates minimal valid NoteMetadata for testing
 */
function createMinimalMetadata(): NoteMetadata {
  return {
    title: null,
    tags: [],
    links: [],
    mentions: [],
  };
}

/**
 * Creates a base note structure for use in other fixtures
 */
function createBaseNoteFields(id: string = 'test-note-123') {
  return {
    id: createNoteId(id),
    title: 'Test Note',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: createMinimalContent(),
    metadata: createMinimalMetadata(),
  };
}

/**
 * Creates a RegularNote fixture
 */
function createRegularNote(id: string = 'regular-123'): RegularNote {
  return {
    ...createBaseNoteFields(id),
    type: undefined,
  };
}

/**
 * Creates a PersonNote fixture
 */
function createPersonNote(id: string = 'person-123'): PersonNote {
  return {
    ...createBaseNoteFields(id),
    type: 'person',
  };
}

/**
 * Creates a ProjectNote fixture
 */
function createProjectNote(id: string = 'project-123'): ProjectNote {
  return {
    ...createBaseNoteFields(id),
    type: 'project',
  };
}

/**
 * Creates a TemplateNote fixture
 */
function createTemplateNote(id: string = 'template-123'): TemplateNote {
  return {
    ...createBaseNoteFields(id),
    type: 'template',
  };
}

/**
 * Creates a SystemNote fixture
 */
function createSystemNote(id: string = 'system-123'): SystemNote {
  return {
    ...createBaseNoteFields(id),
    type: 'system',
  };
}

/**
 * Creates a DailyNote fixture
 */
function createDailyNote(id: string = 'daily-2025-01-15'): DailyNote {
  return {
    ...createBaseNoteFields(id),
    type: 'daily',
    daily: {
      date: '2025-01-15',
    },
  };
}

/**
 * Creates a MeetingNote fixture
 */
function createMeetingNote(id: string = 'meeting-123'): MeetingNote {
  const dailyNoteId = createNoteId('daily-2025-01-15');
  const attendeeId = createNoteId('person-456');
  return {
    ...createBaseNoteFields(id),
    type: 'meeting',
    meeting: {
      date: '2025-01-15',
      dailyNoteId,
      attendees: [attendeeId],
    },
  };
}

// ============================================================================
// Branded Type Helpers
// ============================================================================

describe('createNoteId', () => {
  it('should create a NoteId from a string', () => {
    const id = createNoteId('abc-123');
    expect(id).toBe('abc-123');
  });

  it('should preserve the original string value', () => {
    const original = 'my-unique-note-id';
    const id = createNoteId(original);
    expect(id).toBe(original);
  });

  it('should work with empty string', () => {
    const id = createNoteId('');
    expect(id).toBe('');
  });

  it('should work with special characters', () => {
    const id = createNoteId('note:with:colons:and-dashes_and_underscores');
    expect(id).toBe('note:with:colons:and-dashes_and_underscores');
  });

  it('should work with UUID-style identifiers', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const id = createNoteId(uuid);
    expect(id).toBe(uuid);
  });

  it('should return type compatible with NoteId', () => {
    const id: NoteId = createNoteId('test');
    expect(typeof id).toBe('string');
  });
});

describe('createVaultPath', () => {
  it('should create a VaultPath from a string', () => {
    const path = createVaultPath('/path/to/vault');
    expect(path).toBe('/path/to/vault');
  });

  it('should preserve the original path value', () => {
    const original = '/Users/test/Documents/MyVault';
    const path = createVaultPath(original);
    expect(path).toBe(original);
  });

  it('should work with empty string', () => {
    const path = createVaultPath('');
    expect(path).toBe('');
  });

  it('should work with Windows-style paths', () => {
    const winPath = 'C:\\Users\\test\\Documents\\Vault';
    const path = createVaultPath(winPath);
    expect(path).toBe(winPath);
  });

  it('should work with relative paths', () => {
    const relativePath = './vault';
    const path = createVaultPath(relativePath);
    expect(path).toBe(relativePath);
  });

  it('should return type compatible with VaultPath', () => {
    const path: VaultPath = createVaultPath('/test');
    expect(typeof path).toBe('string');
  });
});

// ============================================================================
// System Note Helpers
// ============================================================================

describe('SYSTEM_NOTE_IDS', () => {
  it('should have TASKS constant', () => {
    expect(SYSTEM_NOTE_IDS.TASKS).toBe('system:tasks');
  });

  it('should be a readonly object', () => {
    // TypeScript enforces this at compile time via `as const`
    // We verify the value is what we expect
    expect(Object.keys(SYSTEM_NOTE_IDS)).toContain('TASKS');
  });
});

describe('isSystemNoteId', () => {
  it('should return true for system:tasks', () => {
    expect(isSystemNoteId('system:tasks')).toBe(true);
  });

  it('should return true for any system: prefixed ID', () => {
    expect(isSystemNoteId('system:settings')).toBe(true);
    expect(isSystemNoteId('system:inbox')).toBe(true);
    expect(isSystemNoteId('system:trash')).toBe(true);
    expect(isSystemNoteId('system:anything')).toBe(true);
  });

  it('should return false for regular note IDs', () => {
    expect(isSystemNoteId('abc-123')).toBe(false);
    expect(isSystemNoteId('note-with-system-in-name')).toBe(false);
    expect(isSystemNoteId('my-system-note')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isSystemNoteId('')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isSystemNoteId(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isSystemNoteId(undefined)).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(isSystemNoteId('System:tasks')).toBe(false);
    expect(isSystemNoteId('SYSTEM:tasks')).toBe(false);
    expect(isSystemNoteId('SYSTEM:TASKS')).toBe(false);
  });

  it('should require the colon after system', () => {
    expect(isSystemNoteId('systemtasks')).toBe(false);
    expect(isSystemNoteId('system')).toBe(false);
  });

  it('should handle system: with nothing after', () => {
    expect(isSystemNoteId('system:')).toBe(true);
  });
});

// ============================================================================
// Task ID Helpers
// ============================================================================

describe('serializeTaskId', () => {
  it('should serialize a TaskId to string format', () => {
    const taskId: TaskId = {
      noteId: createNoteId('note-123'),
      nodeKey: 'node_1a2b',
      textHash: 'a1b2c3d4e5f6a7b8',
    };
    const serialized = serializeTaskId(taskId);
    expect(serialized).toBe('note-123:node_1a2b:a1b2c3d4e5f6a7b8');
  });

  it('should handle noteId with special characters (except colons)', () => {
    const taskId: TaskId = {
      noteId: createNoteId('note-with-dashes_and_underscores'),
      nodeKey: 'node_key',
      textHash: 'hash123456789abc',
    };
    const serialized = serializeTaskId(taskId);
    expect(serialized).toBe('note-with-dashes_and_underscores:node_key:hash123456789abc');
  });

  it('should produce consistent output for same input', () => {
    const taskId: TaskId = {
      noteId: createNoteId('consistent-note'),
      nodeKey: 'node_xyz',
      textHash: 'deadbeef12345678',
    };
    const first = serializeTaskId(taskId);
    const second = serializeTaskId(taskId);
    expect(first).toBe(second);
  });
});

describe('parseTaskId', () => {
  it('should parse a valid serialized TaskId', () => {
    const serialized = 'note-123:node_1a2b:a1b2c3d4e5f6a7b8';
    const taskId = parseTaskId(serialized);
    expect(taskId).not.toBeNull();
    expect(taskId!.noteId).toBe('note-123');
    expect(taskId!.nodeKey).toBe('node_1a2b');
    expect(taskId!.textHash).toBe('a1b2c3d4e5f6a7b8');
  });

  it('should return null for string with wrong number of parts (too few)', () => {
    expect(parseTaskId('note-123:node_1a2b')).toBeNull();
    expect(parseTaskId('note-123')).toBeNull();
    expect(parseTaskId('')).toBeNull();
  });

  it('should return null for string with too many colons', () => {
    expect(parseTaskId('note-123:node_1a2b:hash:extra')).toBeNull();
  });

  it('should return null when any part is empty', () => {
    expect(parseTaskId(':node_1a2b:hash1234')).toBeNull();
    expect(parseTaskId('note-123::hash1234')).toBeNull();
    expect(parseTaskId('note-123:node_1a2b:')).toBeNull();
  });

  it('should round-trip with serializeTaskId', () => {
    const original: TaskId = {
      noteId: createNoteId('round-trip-note'),
      nodeKey: 'node_abc',
      textHash: 'fedcba9876543210',
    };
    const serialized = serializeTaskId(original);
    const parsed = parseTaskId(serialized);
    expect(parsed).not.toBeNull();
    expect(parsed!.noteId).toBe(original.noteId);
    expect(parsed!.nodeKey).toBe(original.nodeKey);
    expect(parsed!.textHash).toBe(original.textHash);
  });

  it('should create proper NoteId type for noteId field', () => {
    const parsed = parseTaskId('my-note:node_key:abcd1234abcd1234');
    expect(parsed).not.toBeNull();
    // The returned noteId should be usable as a NoteId
    const noteId: NoteId = parsed!.noteId;
    expect(noteId).toBe('my-note');
  });
});

// ============================================================================
// Note Type Guards
// ============================================================================

describe('isRegularNote', () => {
  it('should return true for a RegularNote', () => {
    const note = createRegularNote();
    expect(isRegularNote(note)).toBe(true);
  });

  it('should return true for a note with type explicitly undefined', () => {
    const note: Note = { ...createBaseNoteFields(), type: undefined };
    expect(isRegularNote(note)).toBe(true);
  });

  it('should return false for PersonNote', () => {
    const note = createPersonNote();
    expect(isRegularNote(note)).toBe(false);
  });

  it('should return false for ProjectNote', () => {
    const note = createProjectNote();
    expect(isRegularNote(note)).toBe(false);
  });

  it('should return false for TemplateNote', () => {
    const note = createTemplateNote();
    expect(isRegularNote(note)).toBe(false);
  });

  it('should return false for SystemNote', () => {
    const note = createSystemNote();
    expect(isRegularNote(note)).toBe(false);
  });

  it('should return false for DailyNote', () => {
    const note = createDailyNote();
    expect(isRegularNote(note)).toBe(false);
  });

  it('should return false for MeetingNote', () => {
    const note = createMeetingNote();
    expect(isRegularNote(note)).toBe(false);
  });
});

describe('isPersonNote', () => {
  it('should return true for a PersonNote', () => {
    const note = createPersonNote();
    expect(isPersonNote(note)).toBe(true);
  });

  it('should return false for RegularNote', () => {
    const note = createRegularNote();
    expect(isPersonNote(note)).toBe(false);
  });

  it('should return false for other note types', () => {
    expect(isPersonNote(createProjectNote())).toBe(false);
    expect(isPersonNote(createTemplateNote())).toBe(false);
    expect(isPersonNote(createSystemNote())).toBe(false);
    expect(isPersonNote(createDailyNote())).toBe(false);
    expect(isPersonNote(createMeetingNote())).toBe(false);
  });

  it('should narrow the type correctly', () => {
    const note: Note = createPersonNote();
    if (isPersonNote(note)) {
      // TypeScript should know this is a PersonNote
      expect(note.type).toBe('person');
    } else {
      // This branch should not execute
      expect(true).toBe(false);
    }
  });
});

describe('isProjectNote', () => {
  it('should return true for a ProjectNote', () => {
    const note = createProjectNote();
    expect(isProjectNote(note)).toBe(true);
  });

  it('should return false for RegularNote', () => {
    const note = createRegularNote();
    expect(isProjectNote(note)).toBe(false);
  });

  it('should return false for other note types', () => {
    expect(isProjectNote(createPersonNote())).toBe(false);
    expect(isProjectNote(createTemplateNote())).toBe(false);
    expect(isProjectNote(createSystemNote())).toBe(false);
    expect(isProjectNote(createDailyNote())).toBe(false);
    expect(isProjectNote(createMeetingNote())).toBe(false);
  });

  it('should narrow the type correctly', () => {
    const note: Note = createProjectNote();
    if (isProjectNote(note)) {
      expect(note.type).toBe('project');
    } else {
      expect(true).toBe(false);
    }
  });
});

describe('isTemplateNote', () => {
  it('should return true for a TemplateNote', () => {
    const note = createTemplateNote();
    expect(isTemplateNote(note)).toBe(true);
  });

  it('should return false for RegularNote', () => {
    const note = createRegularNote();
    expect(isTemplateNote(note)).toBe(false);
  });

  it('should return false for other note types', () => {
    expect(isTemplateNote(createPersonNote())).toBe(false);
    expect(isTemplateNote(createProjectNote())).toBe(false);
    expect(isTemplateNote(createSystemNote())).toBe(false);
    expect(isTemplateNote(createDailyNote())).toBe(false);
    expect(isTemplateNote(createMeetingNote())).toBe(false);
  });

  it('should narrow the type correctly', () => {
    const note: Note = createTemplateNote();
    if (isTemplateNote(note)) {
      expect(note.type).toBe('template');
    } else {
      expect(true).toBe(false);
    }
  });
});

describe('isSystemNote', () => {
  it('should return true for a SystemNote', () => {
    const note = createSystemNote();
    expect(isSystemNote(note)).toBe(true);
  });

  it('should return false for RegularNote', () => {
    const note = createRegularNote();
    expect(isSystemNote(note)).toBe(false);
  });

  it('should return false for other note types', () => {
    expect(isSystemNote(createPersonNote())).toBe(false);
    expect(isSystemNote(createProjectNote())).toBe(false);
    expect(isSystemNote(createTemplateNote())).toBe(false);
    expect(isSystemNote(createDailyNote())).toBe(false);
    expect(isSystemNote(createMeetingNote())).toBe(false);
  });

  it('should narrow the type correctly', () => {
    const note: Note = createSystemNote();
    if (isSystemNote(note)) {
      expect(note.type).toBe('system');
    } else {
      expect(true).toBe(false);
    }
  });
});

describe('isDailyNote', () => {
  it('should return true for a DailyNote', () => {
    const note = createDailyNote();
    expect(isDailyNote(note)).toBe(true);
  });

  it('should return false for RegularNote', () => {
    const note = createRegularNote();
    expect(isDailyNote(note)).toBe(false);
  });

  it('should return false for other note types', () => {
    expect(isDailyNote(createPersonNote())).toBe(false);
    expect(isDailyNote(createProjectNote())).toBe(false);
    expect(isDailyNote(createTemplateNote())).toBe(false);
    expect(isDailyNote(createSystemNote())).toBe(false);
    expect(isDailyNote(createMeetingNote())).toBe(false);
  });

  it('should narrow the type correctly and provide access to daily data', () => {
    const note: Note = createDailyNote();
    if (isDailyNote(note)) {
      // TypeScript should know note.daily exists
      expect(note.type).toBe('daily');
      expect(note.daily).toBeDefined();
      expect(note.daily.date).toBe('2025-01-15');
    } else {
      expect(true).toBe(false);
    }
  });
});

describe('isMeetingNote', () => {
  it('should return true for a MeetingNote', () => {
    const note = createMeetingNote();
    expect(isMeetingNote(note)).toBe(true);
  });

  it('should return false for RegularNote', () => {
    const note = createRegularNote();
    expect(isMeetingNote(note)).toBe(false);
  });

  it('should return false for other note types', () => {
    expect(isMeetingNote(createPersonNote())).toBe(false);
    expect(isMeetingNote(createProjectNote())).toBe(false);
    expect(isMeetingNote(createTemplateNote())).toBe(false);
    expect(isMeetingNote(createSystemNote())).toBe(false);
    expect(isMeetingNote(createDailyNote())).toBe(false);
  });

  it('should narrow the type correctly and provide access to meeting data', () => {
    const note: Note = createMeetingNote();
    if (isMeetingNote(note)) {
      // TypeScript should know note.meeting exists
      expect(note.type).toBe('meeting');
      expect(note.meeting).toBeDefined();
      expect(note.meeting.date).toBe('2025-01-15');
      expect(note.meeting.dailyNoteId).toBe('daily-2025-01-15');
      expect(note.meeting.attendees).toHaveLength(1);
      expect(note.meeting.attendees[0]).toBe('person-456');
    } else {
      expect(true).toBe(false);
    }
  });
});

// ============================================================================
// Type Guard Exhaustiveness
// ============================================================================

describe('Type Guard Exhaustiveness', () => {
  it('should cover all note types with exactly one guard returning true', () => {
    const allNotes: Note[] = [
      createRegularNote(),
      createPersonNote(),
      createProjectNote(),
      createTemplateNote(),
      createSystemNote(),
      createDailyNote(),
      createMeetingNote(),
    ];

    const guards = [
      isRegularNote,
      isPersonNote,
      isProjectNote,
      isTemplateNote,
      isSystemNote,
      isDailyNote,
      isMeetingNote,
    ];

    for (const note of allNotes) {
      const matchingGuards = guards.filter((guard) => guard(note));
      expect(matchingGuards).toHaveLength(1);
    }
  });

  it('should enable type-safe pattern matching', () => {
    const notes: Note[] = [
      createRegularNote(),
      createPersonNote(),
      createDailyNote(),
      createMeetingNote(),
    ];

    for (const note of notes) {
      let handled = false;

      if (isRegularNote(note)) {
        expect(note.type).toBeUndefined();
        handled = true;
      } else if (isPersonNote(note)) {
        expect(note.type).toBe('person');
        handled = true;
      } else if (isProjectNote(note)) {
        expect(note.type).toBe('project');
        handled = true;
      } else if (isTemplateNote(note)) {
        expect(note.type).toBe('template');
        handled = true;
      } else if (isSystemNote(note)) {
        expect(note.type).toBe('system');
        handled = true;
      } else if (isDailyNote(note)) {
        // TypeScript knows note.daily exists here
        expect(note.daily.date).toBeDefined();
        handled = true;
      } else if (isMeetingNote(note)) {
        // TypeScript knows note.meeting exists here
        expect(note.meeting.attendees).toBeDefined();
        handled = true;
      }

      expect(handled).toBe(true);
    }
  });
});
