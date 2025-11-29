/**
 * ResizeHandle component
 *
 * A draggable handle for resizing panels horizontally.
 * Place at the edge of a panel to enable drag-to-resize.
 */

import { useCallback, useRef, useEffect } from 'react';
import clsx from 'clsx';
import * as styles from './ResizeHandle.css';

export interface ResizeHandleProps {
  /** Which side of the panel this handle is on */
  position: 'left' | 'right';
  /** Callback when dragging with delta movement */
  onResize: (delta: number) => void;
  /** Callback when drag starts */
  onResizeStart?: () => void;
  /** Callback when drag ends */
  onResizeEnd?: () => void;
}

export function ResizeHandle({
  position,
  onResize,
  onResizeStart,
  onResizeEnd,
}: ResizeHandleProps) {
  const isDraggingRef = useRef(false);
  const lastXRef = useRef(0);
  const handleRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      lastXRef.current = e.clientX;
      onResizeStart?.();

      // Add class for visual feedback
      handleRef.current?.classList.add(styles.resizeHandleActive);
    },
    [onResizeStart]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const delta = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;

      // For right-positioned handle (on left panel), positive delta = expand
      // For left-positioned handle (on right panel), negative delta = expand
      onResize(position === 'right' ? delta : -delta);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        handleRef.current?.classList.remove(styles.resizeHandleActive);
        onResizeEnd?.();
      }
    };

    // Listen on document for mouse events to catch drags outside the handle
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [position, onResize, onResizeEnd]);

  return (
    <div
      ref={handleRef}
      className={clsx(
        styles.resizeHandle,
        position === 'right' ? styles.resizeHandleLeft : styles.resizeHandleRight
      )}
      onMouseDown={handleMouseDown}
    >
      <div className={styles.resizeHandleLine} />
    </div>
  );
}
