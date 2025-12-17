/**
 * Test Helpers for Scribe CLI
 *
 * Utilities for creating test fixtures, running CLI commands, and assertions.
 */

import { spawn } from 'child_process';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import type { NoteType, EditorContent, EditorNode, RegularNote } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

/**
 * Result of executing a CLI command.
 */
export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI with the given arguments.
 * Uses bun to execute the CLI source directly.
 */
export async function runCLI(args: string[], cwd?: string): Promise<CLIResult> {
  return new Promise((resolve) => {
    const proc = spawn('bun', ['run', 'src/index.ts', ...args], {
      cwd: cwd ?? join(__dirname, '..'),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    proc.on('error', () => {
      resolve({
        stdout,
        stderr,
        exitCode: 1,
      });
    });
  });
}

/**
 * Options for creating a test note.
 */
export interface TestNoteOptions {
  id: string;
  title: string;
  type?: NoteType;
  tags?: string[];
  links?: string[];
  mentions?: string[];
  content?: EditorContent;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Create a text node.
 */
function createTextNode(text: string): EditorNode {
  return {
    type: 'text',
    format: 0,
    style: '',
    mode: 'normal',
    detail: 0,
    text,
  };
}

/**
 * Create a Lexical content structure from plain text.
 */
export function createLexicalContent(text: string): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: text
        ? [
            {
              type: 'paragraph',
              format: '',
              indent: 0,
              children: [createTextNode(text)],
            },
          ]
        : [],
    },
  };
}

/**
 * Create a Lexical content with a checklist item (task).
 */
export function createLexicalContentWithTask(taskText: string, checked = false): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: [
        {
          type: 'listitem',
          format: '',
          indent: 0,
          value: 1,
          listType: 'check',
          checked,
          children: [createTextNode(taskText)],
        },
      ],
    },
  };
}

/**
 * Create a Lexical content with a heading.
 */
export function createLexicalContentWithHeading(
  headingText: string,
  level: 1 | 2 | 3 | 4 | 5 | 6 = 1
): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: [
        {
          type: 'heading',
          format: '',
          indent: 0,
          tag: `h${level}`,
          children: [createTextNode(headingText)],
        },
      ],
    },
  };
}

/**
 * Create a Lexical content with a wiki-link.
 */
export function createLexicalContentWithWikiLink(
  beforeText: string,
  targetTitle: string,
  targetId: string,
  afterText = ''
): EditorContent {
  const children: EditorNode[] = [];

  if (beforeText) {
    children.push(createTextNode(beforeText));
  }

  children.push({
    type: 'wiki-link',
    targetTitle,
    targetId,
  });

  if (afterText) {
    children.push(createTextNode(afterText));
  }

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          children,
        },
      ],
    },
  };
}

/**
 * Create a Lexical content with a person mention.
 */
export function createLexicalContentWithMention(
  beforeText: string,
  personName: string,
  personId: string,
  afterText = ''
): EditorContent {
  const children: EditorNode[] = [];

  if (beforeText) {
    children.push(createTextNode(beforeText));
  }

  children.push({
    type: 'person-mention',
    personName,
    personId,
  });

  if (afterText) {
    children.push(createTextNode(afterText));
  }

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          children,
        },
      ],
    },
  };
}

/**
 * Create a test note object.
 * Returns a RegularNote by default (type is undefined).
 */
export function createTestNote(options: TestNoteOptions): RegularNote {
  const now = Date.now();
  const noteId = createNoteId(options.id);
  const links = (options.links ?? []).map(createNoteId);
  const mentions = (options.mentions ?? []).map(createNoteId);

  return {
    id: noteId,
    title: options.title,
    type: undefined, // Regular note
    tags: options.tags ?? [],
    content: options.content ?? createLexicalContent(''),
    metadata: {
      title: options.title,
      tags: options.tags ?? [],
      links,
      mentions,
    },
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
  };
}

/**
 * Write a note to a vault directory.
 */
export async function writeNoteToVault(vaultPath: string, note: RegularNote): Promise<void> {
  const notesDir = join(vaultPath, 'notes');
  await mkdir(notesDir, { recursive: true });

  const notePath = join(notesDir, `${note.id}.json`);
  await writeFile(notePath, JSON.stringify(note, null, 2), 'utf-8');
}

/**
 * Initialize a test vault with optional notes.
 */
export async function initializeTestVault(
  vaultPath: string,
  notes: RegularNote[] = []
): Promise<void> {
  // Create vault structure
  const notesDir = join(vaultPath, 'notes');
  await mkdir(notesDir, { recursive: true });

  // Create .scribe marker
  await writeFile(join(vaultPath, '.scribe'), JSON.stringify({ version: 1 }), 'utf-8');

  // Write notes
  for (const note of notes) {
    await writeNoteToVault(vaultPath, note);
  }
}

/**
 * Clean up a test vault directory.
 */
export async function cleanupTestVault(vaultPath: string): Promise<void> {
  await rm(vaultPath, { recursive: true, force: true }).catch(() => {
    // Ignore errors
  });
}

/**
 * Parse JSON output from CLI, with helpful error message on failure.
 */
export function parseJSONOutput<T>(output: string): T {
  try {
    return JSON.parse(output) as T;
  } catch (e) {
    throw new Error(`Failed to parse CLI output as JSON:\n${output}\nError: ${e}`);
  }
}
