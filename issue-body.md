# Collapsible Headings

I want the ability to be able to collapse or expand sections of my notes by their headings.

---

## Technical Specification

### Overview

This feature allows users to collapse/expand content sections under headings. When hovering over a heading, a fold/expand icon appears. Clicking it toggles visibility of all content until the next heading of equal or higher level.

### Architecture Decision

**Approach: Decorator-based fold controls + CSS visibility**

Rather than restructuring the document tree (which would break markdown export and complicate the data model), we'll use:
1. A **decorator overlay** that renders fold icons on headings
2. **CSS-based hiding** of content between headings
3. **State stored in heading node** via a custom `CollapsibleHeadingNode`

This approach extends `HeadingNode` from `@lexical/rich-text` directly. Note: This differs from existing custom nodes like `WikiLinkNode` and `PersonMentionNode` which extend `DecoratorNode`, but extending `HeadingNode` is the correct approach here since we want to preserve heading semantics.

---

### Implementation Plan

#### 1. CollapsibleHeadingNode (`plugins/CollapsibleHeadingNode.ts`)

Extend `HeadingNode` from `@lexical/rich-text` to add collapse state:

```typescript
import { HeadingNode, SerializedHeadingNode, HeadingTagType } from '@lexical/rich-text';
import { NodeKey, Spread, LexicalNode, EditorConfig } from 'lexical';

type SerializedCollapsibleHeadingNode = Spread<
  { collapsed: boolean },
  SerializedHeadingNode
>;

export class CollapsibleHeadingNode extends HeadingNode {
  __collapsed: boolean;

  static getType(): string {
    return 'collapsible-heading';
  }

  static clone(node: CollapsibleHeadingNode): CollapsibleHeadingNode {
    return new CollapsibleHeadingNode(node.__tag, node.__collapsed, node.__key);
  }

  constructor(tag: HeadingTagType, collapsed: boolean = false, key?: NodeKey) {
    super(tag, key);
    this.__collapsed = collapsed;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.setAttribute('data-collapsed', String(this.__collapsed));
    dom.classList.add('collapsible-heading');
    return dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config);
    if (prevNode.__collapsed !== this.__collapsed) {
      dom.setAttribute('data-collapsed', String(this.__collapsed));
    }
    return updated;
  }

  isCollapsed(): boolean {
    return this.getLatest().__collapsed;
  }

  setCollapsed(collapsed: boolean): void {
    const writable = this.getWritable();
    writable.__collapsed = collapsed;
  }

  toggleCollapsed(): void {
    this.setCollapsed(!this.isCollapsed());
  }

  exportJSON(): SerializedCollapsibleHeadingNode {
    return {
      ...super.exportJSON(),
      type: 'collapsible-heading',
      collapsed: this.__collapsed,
    };
  }

  static importJSON(json: SerializedCollapsibleHeadingNode): CollapsibleHeadingNode {
    const node = $createCollapsibleHeadingNode(json.tag);
    node.setCollapsed(json.collapsed);
    return node;
  }
}

export function $createCollapsibleHeadingNode(tag: HeadingTagType): CollapsibleHeadingNode {
  return new CollapsibleHeadingNode(tag);
}

export function $isCollapsibleHeadingNode(node: LexicalNode | null | undefined): node is CollapsibleHeadingNode {
  return node instanceof CollapsibleHeadingNode;
}
```

#### 2. CollapsibleHeadingPlugin (`plugins/CollapsibleHeadingPlugin.tsx`)

Plugin responsibilities:
- Render fold icons on heading hover
- Handle click to toggle collapse
- Apply CSS classes to hide collapsed content
- Transform incoming `HeadingNode` to `CollapsibleHeadingNode` (for markdown import compatibility)

```typescript
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  $getNodeByKey,
  $getRoot,
  COMMAND_PRIORITY_LOW,
  createCommand,
  LexicalCommand,
  NodeKey,
} from 'lexical';
import { HeadingNode } from '@lexical/rich-text';
import { $isCollapsibleHeadingNode, $createCollapsibleHeadingNode, CollapsibleHeadingNode } from './CollapsibleHeadingNode';

export const TOGGLE_COLLAPSE_COMMAND: LexicalCommand<string> = createCommand();

interface FoldIconProps {
  collapsed: boolean;
  position: { top: number; left: number };
  onToggle: () => void;
}

function FoldIcon({ collapsed, position, onToggle }: FoldIconProps) {
  return createPortal(
    <button
      className="fold-icon"
      style={{ top: position.top, left: position.left }}
      onClick={onToggle}
      aria-label={collapsed ? 'Expand section' : 'Collapse section'}
      aria-expanded={!collapsed}
      type="button"
    >
      {collapsed ? '▶' : '▼'}
    </button>,
    document.body
  );
}

export function CollapsibleHeadingPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [hoveredHeading, setHoveredHeading] = useState<{
    key: NodeKey;
    collapsed: boolean;
    position: { top: number; left: number };
  } | null>(null);
  
  const updateCollapsedSectionsRef = useRef<() => void>();

  // Transform HeadingNode to CollapsibleHeadingNode for markdown import compatibility
  useEffect(() => {
    return editor.registerNodeTransform(HeadingNode, (node) => {
      if (node.getType() === 'heading') {
        const collapsed = $createCollapsibleHeadingNode(node.getTag());
        collapsed.append(...node.getChildren());
        node.replace(collapsed);
      }
    });
  }, [editor]);

  // Register command for toggling collapse
  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_COLLAPSE_COMMAND,
      (nodeKey: string) => {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isCollapsibleHeadingNode(node)) {
            node.toggleCollapsed();
            updateCollapsedSectionsRef.current?.();
          }
        });
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  // Handle hover detection on headings
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const heading = target.closest('.collapsible-heading');
      
      if (heading) {
        const rect = heading.getBoundingClientRect();
        // Get node key from Lexical's DOM-to-node mapping
        const key = editor.getEditorState().read(() => {
          // Implementation: traverse editor state to find matching node
          const root = $getRoot();
          for (const child of root.getChildren()) {
            if ($isCollapsibleHeadingNode(child)) {
              const element = editor.getElementByKey(child.getKey());
              if (element === heading) {
                return child.getKey();
              }
            }
          }
          return null;
        });
        
        if (key) {
          const collapsed = heading.getAttribute('data-collapsed') === 'true';
          setHoveredHeading({
            key,
            collapsed,
            position: { top: rect.top, left: rect.left - 24 }
          });
        }
      } else {
        setHoveredHeading(null);
      }
    };

    rootElement.addEventListener('mousemove', handleMouseMove);
    return () => rootElement.removeEventListener('mousemove', handleMouseMove);
  }, [editor]);

  // Apply CSS to hide collapsed sections
  const updateCollapsedSections = useCallback(() => {
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      let currentCollapsed: { level: number; active: boolean } | null = null;

      children.forEach((child) => {
        if ($isCollapsibleHeadingNode(child)) {
          const level = getHeadingLevel(child.getTag());
          
          // Check if this heading ends a collapsed section
          if (currentCollapsed && level <= currentCollapsed.level) {
            currentCollapsed = null;
          }
          
          // Start new collapsed section if this heading is collapsed
          if (child.isCollapsed()) {
            currentCollapsed = { level, active: true };
          }

          // Clear collapsed-content class from the heading itself
          const element = editor.getElementByKey(child.getKey());
          element?.classList.remove('collapsed-content');
        } else if (currentCollapsed?.active) {
          // Mark non-heading content as collapsed
          const element = editor.getElementByKey(child.getKey());
          element?.classList.add('collapsed-content');
        } else {
          // Clear collapsed-content class if not in collapsed section
          const element = editor.getElementByKey(child.getKey());
          element?.classList.remove('collapsed-content');
        }
      });
    });
  }, [editor]);

  // Store ref for use in command handler
  updateCollapsedSectionsRef.current = updateCollapsedSections;

  // Initial update
  useEffect(() => {
    updateCollapsedSections();
  }, [updateCollapsedSections]);

  if (!hoveredHeading) return null;

  return (
    <FoldIcon
      collapsed={hoveredHeading.collapsed}
      position={hoveredHeading.position}
      onToggle={() => editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, hoveredHeading.key)}
    />
  );
}

function getHeadingLevel(tag: string): number {
  return parseInt(tag.replace('h', ''), 10);
}
```

#### 3. Styles (`EditorRoot.css.ts` additions)

```typescript
import { style, globalStyle } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';

// Fold icon - appears on hover
export const foldIcon = style({
  position: 'absolute',
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  opacity: 0,
  transition: 'opacity 150ms ease',
  color: vars.color.foregroundMuted,
  border: 'none',
  background: 'transparent',
  padding: 0,
  ':hover': {
    color: vars.color.foreground,
  },
  ':focus-visible': {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: '2px',
  },
});

// Show fold icon when heading is hovered
export const collapsibleHeading = style({
  position: 'relative',
  selectors: {
    '&:hover .fold-icon': {
      opacity: 1,
    },
  },
});

// Collapsed heading indicator (subtle visual cue)
globalStyle('.collapsible-heading[data-collapsed="true"]::after', {
  content: '"..."',
  color: vars.color.foregroundMuted,
  marginLeft: vars.spacing['2'],
  fontSize: '0.8em',
});

// Hidden content under collapsed headings
globalStyle('.collapsed-content', {
  display: 'none',
});
```

#### 4. Editor Integration (`EditorRoot.tsx` changes)

```typescript
// Add to imports
import { CollapsibleHeadingNode } from './plugins/CollapsibleHeadingNode';
import { CollapsibleHeadingPlugin } from './plugins/CollapsibleHeadingPlugin';

// Replace HeadingNode with CollapsibleHeadingNode in nodes array
nodes: [
  CollapsibleHeadingNode,  // Instead of HeadingNode
  // ... rest of nodes
],

// Add plugin in the component
<CollapsibleHeadingPlugin />
```

#### 5. Update Heading Creation Points

The following files use `$createHeadingNode` directly and must be updated:

**`SlashMenu/commands.ts`:**
```typescript
// Replace: import { $createHeadingNode } from '@lexical/rich-text';
// With:
import { $createCollapsibleHeadingNode } from '../plugins/CollapsibleHeadingNode';

// Update all heading creation calls
```

**`SelectionToolbar/SelectionToolbarPlugin.tsx`:**
```typescript
// Replace: import { $isHeadingNode, $createHeadingNode, HeadingTagType } from '@lexical/rich-text';
// With:
import { $isHeadingNode, HeadingTagType } from '@lexical/rich-text';
import { $createCollapsibleHeadingNode, $isCollapsibleHeadingNode } from '../plugins/CollapsibleHeadingNode';

// Update heading creation and detection
```

---

### Section Boundaries

A "section" is defined as:
- **Start**: The heading node itself
- **End**: The next heading of **equal or higher level** (h1 ≥ h2 ≥ h3...), OR end of document

Example:
```
# Heading 1        ← Collapsing this hides everything until next h1 or EOF
Some content
## Heading 2       ← Collapsing this hides until next h1 or h2
More content
### Heading 3      ← Collapsing this hides until next h1, h2, or h3
Even more content
## Another H2      ← This ends the h3 section above
```

---

### State Persistence

**Decision: Persist in note JSON**

The `collapsed` state is stored in the serialized node JSON. This means:
- Collapse state persists when note is saved/reopened
- State is per-note, not global
- Markdown export ignores collapse state (content is always exported)

**Consideration:** This increases note JSON size slightly. An alternative would be storing collapse state in localStorage keyed by note ID, which would keep note files smaller but require managing a separate state store.

---

### Markdown Export Considerations

- Collapsed sections are **fully exported** - collapse is a view-only feature
- The `CollapsibleHeadingNode` exports to markdown exactly like regular headings (`#`, `##`, etc.)
- No special markdown syntax is used for collapse state

---

### Accessibility Requirements

- Fold icons must have `aria-label` describing the action ("Collapse section" / "Expand section")
- Fold icons must have `aria-expanded` attribute reflecting current state
- Fold icons must be focusable and activatable via keyboard (Enter/Space)
- Focus must be visible with appropriate outline styling
- Consider announcing state changes to screen readers

---

### Touch Device Support

The current hover-based design doesn't work well on touch devices. Options:
1. **Always show fold icons** on touch devices (detect via media query or touch events)
2. **Add tap-and-hold gesture** to toggle collapse
3. **Add a dedicated "fold all" button** in the toolbar

Recommend option 1 for simplicity.

---

### Keyboard Shortcuts (Future Enhancement)

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + [` | Collapse current section |
| `Cmd/Ctrl + Shift + ]` | Expand current section |
| `Cmd/Ctrl + Shift + \` | Toggle all headings |

---

### Performance Considerations

The `updateCollapsedSections` function iterates through all root children on every toggle. For large documents:
- Consider memoizing section boundaries
- Consider using a more efficient DOM update strategy
- Consider debouncing updates if multiple toggles happen quickly

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `plugins/CollapsibleHeadingNode.ts` | Create - Custom heading node with collapse state |
| `plugins/CollapsibleHeadingPlugin.tsx` | Create - Plugin for fold UI and behavior |
| `EditorRoot.tsx` | Modify - Register node and plugin, replace HeadingNode |
| `EditorRoot.css.ts` | Modify - Add fold icon and collapsed content styles |
| `SlashMenu/commands.ts` | Modify - Use `$createCollapsibleHeadingNode` |
| `SelectionToolbar/SelectionToolbarPlugin.tsx` | Modify - Use `$createCollapsibleHeadingNode` |
| `SlashMenu/SlashMenuPlugin.test.tsx` | Modify - Update imports |
| `SelectionToolbar/SelectionToolbarPlugin.test.tsx` | Modify - Update imports |

---

### Testing Strategy

1. **Unit tests** for `CollapsibleHeadingNode`:
   - Serialization/deserialization preserves collapse state
   - `toggleCollapsed()` works correctly
   - DOM attributes update on state change
   - `clone()` preserves collapse state

2. **Integration tests**:
   - Clicking fold icon toggles section visibility
   - Section boundaries are calculated correctly
   - Nested headings collapse independently
   - State persists across note save/load
   - HeadingNode transform works for markdown import

3. **Edge cases**:
   - Collapsing heading at end of document
   - Multiple consecutive headings
   - Empty sections
   - Copy/paste of collapsed sections
   - Undo/redo of collapse operations

4. **Accessibility tests**:
   - Verify aria-label and aria-expanded attributes
   - Verify keyboard navigation works
   - Verify focus states are visible

---

### Acceptance Criteria

- [ ] Hovering over any heading shows a fold/expand icon to the left
- [ ] Clicking the icon collapses content until next same-or-higher-level heading
- [ ] Collapsed sections show a visual indicator (e.g., "..." or chevron)
- [ ] Collapse state persists when note is saved and reopened
- [ ] Markdown export includes all content regardless of collapse state
- [ ] Works with all heading levels (h1-h6)
- [ ] Fold icons are keyboard accessible (focusable, activatable via Enter/Space)
- [ ] Fold icons have appropriate ARIA attributes
- [ ] Markdown import (typing `# ` etc.) creates collapsible headings
- [ ] SlashMenu heading commands create collapsible headings
- [ ] SelectionToolbar heading formatting creates collapsible headings
