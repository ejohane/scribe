import React, { useCallback, useState } from 'react';
import { NoteListPage } from '../pages/NoteListPage';

export interface EditorShellProps {
  noteId: string | null;
  onNoteSelect: (noteId: string) => void;
  sidebarOpen?: boolean;
  defaultSidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  onSettingsOpen?: () => void;
  renderMenuButton?: (args: { isOpen: boolean; toggle: () => void }) => React.ReactNode;
  renderSidebarFooter?: (args: { isOpen: boolean }) => React.ReactNode;
  renderSettingsButton?: (args: { onOpen: () => void }) => React.ReactNode;
  renderTitlebarDragRegion?: () => React.ReactNode;
  children: React.ReactNode;
}

export function EditorShell({
  noteId,
  onNoteSelect,
  sidebarOpen,
  defaultSidebarOpen = false,
  onSidebarOpenChange,
  onSettingsOpen,
  renderMenuButton,
  renderSidebarFooter,
  renderSettingsButton,
  renderTitlebarDragRegion,
  children,
}: EditorShellProps) {
  const isControlled = sidebarOpen !== undefined;
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(defaultSidebarOpen);
  const isOpen = isControlled ? (sidebarOpen ?? false) : internalSidebarOpen;

  const handleSidebarOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalSidebarOpen(nextOpen);
      }
      onSidebarOpenChange?.(nextOpen);
    },
    [isControlled, onSidebarOpenChange]
  );

  const handleToggle = useCallback(() => {
    handleSidebarOpenChange(!isOpen);
  }, [handleSidebarOpenChange, isOpen]);

  const menuButtonSlot = renderMenuButton
    ? () => renderMenuButton({ isOpen, toggle: handleToggle })
    : undefined;
  const titlebarDragRegionSlot = renderTitlebarDragRegion
    ? () => renderTitlebarDragRegion()
    : undefined;
  const canInjectSlots = React.isValidElement(children) && typeof children.type !== 'string';
  const injectedProps: {
    renderMenuButton?: () => React.ReactNode;
    renderTitlebarDragRegion?: () => React.ReactNode;
  } = {};

  if (menuButtonSlot) {
    injectedProps.renderMenuButton = menuButtonSlot;
  }
  if (titlebarDragRegionSlot) {
    injectedProps.renderTitlebarDragRegion = titlebarDragRegionSlot;
  }

  const shouldInjectSlots = canInjectSlots && Object.keys(injectedProps).length > 0;
  const resolvedChildren = shouldInjectSlots
    ? React.cloneElement(children as React.ReactElement<typeof injectedProps>, injectedProps)
    : children;

  const sidebarFooter = renderSidebarFooter?.({ isOpen });
  const settingsButton = renderSettingsButton?.({ onOpen: onSettingsOpen ?? (() => {}) });
  const shouldRenderMenuButton = !shouldInjectSlots && menuButtonSlot;
  const shouldRenderTitlebarDragRegion = !shouldInjectSlots && titlebarDragRegionSlot;

  return (
    <div className="editor-layout" data-sidebar-open={isOpen}>
      <aside className="editor-sidebar">
        <div style={{ position: 'relative', height: '100%' }}>
          <NoteListPage onNoteSelect={onNoteSelect} selectedNoteId={noteId ?? undefined} />
          {sidebarFooter}
          {settingsButton}
        </div>
      </aside>
      <div className="editor-canvas">
        {shouldRenderTitlebarDragRegion && titlebarDragRegionSlot && titlebarDragRegionSlot()}
        {shouldRenderMenuButton && (
          <div className="note-editor-menu-button">{menuButtonSlot()}</div>
        )}
        {resolvedChildren}
      </div>
    </div>
  );
}
