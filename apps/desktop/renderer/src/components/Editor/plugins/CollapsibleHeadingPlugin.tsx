/**
 * CollapsibleHeadingPlugin
 *
 * Provides collapsible heading functionality for the Lexical editor.
 * This plugin enables users to collapse/expand sections under headings,
 * making long documents more navigable.
 *
 * Features:
 * - HeadingNode → CollapsibleHeadingNode transform
 * - FoldIcon component with hover positioning via portal
 * - TOGGLE_COLLAPSE_COMMAND handler
 * - Section boundary logic respecting heading hierarchy
 * - Full accessibility (ARIA attributes, keyboard support)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode } from '@lexical/rich-text';
import {
  $getNodeByKey,
  $getRoot,
  createCommand,
  COMMAND_PRIORITY_LOW,
  type LexicalCommand,
} from 'lexical';
import { createLogger } from '@scribe/shared';
import { $createCollapsibleHeadingNode, $isCollapsibleHeadingNode } from './CollapsibleHeadingNode';
import { foldIcon, foldIconVisible } from '../EditorRoot.css';

const log = createLogger({ prefix: 'CollapsibleHeadingPlugin' });

/**
 * Command to toggle the collapsed state of a heading.
 * The payload is the nodeKey of the heading to toggle.
 */
export const TOGGLE_COLLAPSE_COMMAND: LexicalCommand<string> =
  createCommand('TOGGLE_COLLAPSE_COMMAND');

/**
 * Props for the FoldIcon component.
 */
interface FoldIconProps {
  /** Whether the heading is currently collapsed */
  collapsed: boolean;
  /** Absolute position for the fold icon */
  position: { top: number; left: number };
  /** Callback when the icon is clicked or activated */
  onToggle: () => void;
  /** Whether the icon should be visible */
  visible: boolean;
  /** Callback when mouse enters the icon */
  onMouseEnter: () => void;
  /** Callback when mouse leaves the icon */
  onMouseLeave: () => void;
}

/**
 * FoldIcon component - renders the collapse/expand button.
 * Positioned absolutely via portal and appears on heading hover.
 */
function FoldIcon({
  collapsed,
  position,
  onToggle,
  visible,
  onMouseEnter,
  onMouseLeave,
}: FoldIconProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle();
    }
  };

  return createPortal(
    <button
      className={`${foldIcon} ${visible ? foldIconVisible : ''}`}
      style={{ top: position.top, left: position.left }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={collapsed ? 'Expand section' : 'Collapse section'}
      aria-expanded={!collapsed}
      type="button"
      tabIndex={visible ? 0 : -1}
    >
      {collapsed ? '▶' : '▼'}
    </button>,
    document.body
  );
}

/**
 * Tracked heading state for hover detection.
 */
interface HoveredHeading {
  nodeKey: string;
  collapsed: boolean;
  position: { top: number; left: number };
}

/**
 * CollapsibleHeadingPlugin - main plugin component.
 *
 * Responsibilities:
 * 1. Transform HeadingNode to CollapsibleHeadingNode
 * 2. Handle TOGGLE_COLLAPSE_COMMAND
 * 3. Manage hover state and fold icon positioning
 * 4. Update collapsed-content CSS classes on affected nodes
 */
export function CollapsibleHeadingPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [hoveredHeading, setHoveredHeading] = useState<HoveredHeading | null>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMouseOverFoldIconRef = useRef(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Updates the collapsed-content class on all non-heading children
   * based on the current collapse state of headings.
   */
  const updateCollapsedSections = useCallback(() => {
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const children = root.getChildren();
      let currentCollapsed: { level: number; key: string } | null = null;

      children.forEach((child) => {
        const element = editor.getElementByKey(child.getKey());
        if (!element) return;

        if ($isCollapsibleHeadingNode(child)) {
          const tag = child.getTag();
          const level = parseInt(tag.replace('h', ''), 10);

          // End collapsed section if same or higher level heading
          if (currentCollapsed && level <= currentCollapsed.level) {
            currentCollapsed = null;
          }

          // Start new collapsed section if this heading is collapsed
          if (child.isCollapsed()) {
            currentCollapsed = { level, key: child.getKey() };
          }

          // Headings themselves are never hidden
          element.classList.remove('collapsed-content');
        } else if (currentCollapsed) {
          // This content is under a collapsed heading
          element.classList.add('collapsed-content');
        } else {
          // This content is not under a collapsed heading
          element.classList.remove('collapsed-content');
        }
      });
    });
  }, [editor]);

  /**
   * Register HeadingNode transform to convert to CollapsibleHeadingNode.
   */
  useEffect(() => {
    return editor.registerNodeTransform(HeadingNode, (node) => {
      // Don't transform if it's already a CollapsibleHeadingNode
      if ($isCollapsibleHeadingNode(node)) {
        return;
      }

      const tag = node.getTag();
      const collapsed = $createCollapsibleHeadingNode(tag);

      // Copy children from the original heading
      const children = node.getChildren();
      children.forEach((child) => {
        collapsed.append(child);
      });

      // Copy formatting
      collapsed.setFormat(node.getFormatType());
      collapsed.setIndent(node.getIndent());
      collapsed.setDirection(node.getDirection());

      // Replace the original node
      node.replace(collapsed);
    });
  }, [editor]);

  /**
   * Register TOGGLE_COLLAPSE_COMMAND handler.
   */
  useEffect(() => {
    return editor.registerCommand(
      TOGGLE_COLLAPSE_COMMAND,
      (nodeKey: string) => {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isCollapsibleHeadingNode(node)) {
            node.toggleCollapsed();
            log.debug('Toggled collapse', { nodeKey, collapsed: node.isCollapsed() });
          }
        });

        // Schedule update of collapsed sections after state change
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
          updateCollapsedSections();
          // Update hovered heading state if it matches
          setHoveredHeading((prev) => {
            if (prev && prev.nodeKey === nodeKey) {
              return { ...prev, collapsed: !prev.collapsed };
            }
            return prev;
          });
        }, 0);

        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, updateCollapsedSections]);

  /**
   * Update collapsed sections when editor state changes.
   */
  useEffect(() => {
    return editor.registerUpdateListener(() => {
      updateCollapsedSections();
    });
  }, [editor, updateCollapsedSections]);

  /**
   * Schedule hiding the fold icon with a delay.
   * This allows the user to move from the heading to the fold icon
   * without the icon disappearing.
   */
  const scheduleHide = useCallback(() => {
    // Clear any existing hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    // Schedule hiding after a short delay
    hideTimeoutRef.current = setTimeout(() => {
      // Only hide if mouse is not over the fold icon
      if (!isMouseOverFoldIconRef.current) {
        setHoveredHeading(null);
      }
    }, 100); // 100ms delay gives time to move to the icon
  }, []);

  /**
   * Cancel any scheduled hide operation.
   */
  const cancelHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  /**
   * Handle mouse move for hover detection.
   */
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const heading = target.closest('.collapsible-heading') as HTMLElement | null;

      if (heading) {
        // Cancel any pending hide since we're over a heading
        cancelHide();

        const rect = heading.getBoundingClientRect();
        const rootRect = rootElement.getBoundingClientRect();

        // Find the node key from the DOM element
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const children = root.getChildren();

          for (const child of children) {
            if ($isCollapsibleHeadingNode(child)) {
              const element = editor.getElementByKey(child.getKey());
              if (element === heading) {
                setHoveredHeading({
                  nodeKey: child.getKey(),
                  collapsed: child.isCollapsed(),
                  position: {
                    // Position to the left of the heading, in the margin
                    top: rect.top + rect.height / 2 - 12, // Center vertically
                    left: rootRect.left - 28, // Left margin
                  },
                });
                return;
              }
            }
          }
        });
      } else if (!isMouseOverFoldIconRef.current) {
        // Not over a heading and not over the fold icon - schedule hide
        scheduleHide();
      }
    };

    const handleMouseLeave = () => {
      // When leaving the editor, schedule hide (but don't immediately hide
      // in case user is moving to the fold icon)
      scheduleHide();
    };

    rootElement.addEventListener('mousemove', handleMouseMove);
    rootElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      rootElement.removeEventListener('mousemove', handleMouseMove);
      rootElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [editor, scheduleHide, cancelHide]);

  /**
   * Cleanup timeouts on unmount.
   */
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle fold icon toggle.
   */
  const handleToggle = useCallback(() => {
    if (hoveredHeading) {
      editor.dispatchCommand(TOGGLE_COLLAPSE_COMMAND, hoveredHeading.nodeKey);
    }
  }, [editor, hoveredHeading]);

  /**
   * Handle mouse entering the fold icon.
   */
  const handleFoldIconMouseEnter = useCallback(() => {
    isMouseOverFoldIconRef.current = true;
    cancelHide();
  }, [cancelHide]);

  /**
   * Handle mouse leaving the fold icon.
   */
  const handleFoldIconMouseLeave = useCallback(() => {
    isMouseOverFoldIconRef.current = false;
    scheduleHide();
  }, [scheduleHide]);

  // Render fold icon if we have a hovered heading
  if (!hoveredHeading) {
    return null;
  }

  return (
    <FoldIcon
      collapsed={hoveredHeading.collapsed}
      position={hoveredHeading.position}
      onToggle={handleToggle}
      visible={true}
      onMouseEnter={handleFoldIconMouseEnter}
      onMouseLeave={handleFoldIconMouseLeave}
    />
  );
}
