/**
 * Client-side Daily Note Plugin
 *
 * Exports the client plugin factory and initialization helpers.
 *
 * @module
 */

import { createElement, useEffect, useMemo, type ReactNode } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { ClientPlugin, ClientPluginContext } from '@scribe/plugin-core';
import {
  $applyNodeReplacement,
  $getRoot,
  DecoratorNode,
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import { manifest } from '../shared/manifest.js';
import {
  ensureToday,
  openDailyNoteCommandHandler,
  setUseScribeClient,
} from './dailyNoteCommand.js';
import {
  createDailyContent,
  formatDailyHeaderDate,
  getOrCreateDailyNoteId,
  normalizeDailyHeaderDate,
} from './dailyNoteUtils.js';

export { manifest } from '../shared/manifest.js';
export {
  ensureToday,
  openDailyNoteCommandHandler,
  setUseScribeClient,
} from './dailyNoteCommand.js';
export {
  createDailyContent,
  formatDailyHeaderDate,
  getOrCreateDailyNoteId,
  normalizeDailyHeaderDate,
} from './dailyNoteUtils.js';

export type SerializedDailyHeaderNode = Spread<
  {
    date: string;
  },
  SerializedLexicalNode
>;

export class DailyHeaderNode extends DecoratorNode<ReactNode> {
  __date: string;

  static getType(): string {
    return 'DailyHeaderNode';
  }

  static clone(node: DailyHeaderNode): DailyHeaderNode {
    return new DailyHeaderNode(node.__date, node.__key);
  }

  constructor(date?: unknown, key?: unknown) {
    super(typeof key === 'string' ? (key as NodeKey) : undefined);
    if (typeof date === 'string') {
      this.__date = normalizeDailyHeaderDate(date);
    } else {
      this.__date = formatDailyHeaderDate(new Date());
    }
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const container = document.createElement('div');
    container.className = 'daily-note-header';
    return container;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): ReactNode {
    return createElement(
      'h1',
      {
        className: 'daily-note-header-title scribe-h1',
        contentEditable: false,
      },
      this.__date
    );
  }

  isInline(): boolean {
    return false;
  }

  getDate(): string {
    return this.getLatest().__date;
  }

  setDate(date: string): void {
    const writable = this.getWritable();
    writable.__date = date;
  }

  getTextContent(): string {
    return this.getLatest().__date;
  }

  exportJSON(): SerializedDailyHeaderNode {
    return {
      type: 'DailyHeaderNode',
      version: 1,
      date: this.__date,
    };
  }

  static importJSON(serializedNode: SerializedDailyHeaderNode): DailyHeaderNode {
    return $createDailyHeaderNode(serializedNode.date);
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('h1');
    element.textContent = this.getDate();
    element.setAttribute('contenteditable', 'false');
    return { element };
  }
}

export function $createDailyHeaderNode(date: string): DailyHeaderNode {
  return $applyNodeReplacement(new DailyHeaderNode(date));
}

export function $isDailyHeaderNode(node: LexicalNode | null | undefined): node is DailyHeaderNode {
  return node instanceof DailyHeaderNode;
}

function DailyHeaderPlugin(): null {
  const [editor] = useLexicalComposerContext();
  const formattedDate = useMemo(() => formatDailyHeaderDate(new Date()), []);

  useEffect(() => {
    const ensureDailyHeader = (editorState = editor.getEditorState()) => {
      let hasHeader = false;
      let isFirst = false;
      let hasExtras = false;

      editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        let headerCount = 0;

        children.forEach((child, index) => {
          if ($isDailyHeaderNode(child)) {
            headerCount += 1;
            if (index === 0) {
              isFirst = true;
            }
          }
        });

        hasHeader = headerCount > 0;
        hasExtras = headerCount > 1;
      });

      if (hasHeader && isFirst && !hasExtras) {
        return;
      }

      editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();
        const headerNodes = children.filter($isDailyHeaderNode);
        const firstChild = root.getFirstChild();

        if (headerNodes.length === 0) {
          const headerNode = $createDailyHeaderNode(formattedDate);
          if (firstChild) {
            firstChild.insertBefore(headerNode);
          } else {
            root.append(headerNode);
          }
          return;
        }

        const [primaryHeader, ...extraHeaders] = headerNodes;
        const normalizedDate = normalizeDailyHeaderDate(primaryHeader.getDate());

        if (primaryHeader.getDate() !== normalizedDate) {
          primaryHeader.setDate(normalizedDate);
        }

        if (firstChild !== primaryHeader) {
          primaryHeader.remove();
          if (firstChild) {
            firstChild.insertBefore(primaryHeader);
          } else {
            root.append(primaryHeader);
          }
        }

        extraHeaders.forEach((header) => header.remove());
      });
    };

    ensureDailyHeader();

    return editor.registerUpdateListener(({ editorState }) => {
      ensureDailyHeader(editorState);
    });
  }, [editor, formattedDate]);

  return null;
}

export function createClientPlugin(_context: ClientPluginContext): ClientPlugin {
  return {
    manifest,
    commandPaletteCommands: {
      'dailyNote.openToday': openDailyNoteCommandHandler,
    },
    editorExtensions: {
      nodes: [DailyHeaderNode],
      plugins: [DailyHeaderPlugin],
    },
  };
}

type DailyNoteClientHook = NonNullable<Parameters<typeof setUseScribeClient>[0]>;

export function initializeClientPlugin(useScribeClient: DailyNoteClientHook): void {
  setUseScribeClient(useScribeClient);
}
