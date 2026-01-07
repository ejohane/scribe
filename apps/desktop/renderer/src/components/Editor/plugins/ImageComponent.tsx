import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import { $isImageNode, type ImageComponentProps } from './ImageNode';
import { createLogger } from '@scribe/shared';
import * as styles from './ImageComponent.css';

const log = createLogger({ prefix: 'ImageComponent' });

type LoadingState = 'loading' | 'loaded' | 'error';

export default function ImageComponent({
  assetId,
  alt,
  ext,
  width,
  height,
  nodeKey,
}: ImageComponentProps): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [currentDimensions, setCurrentDimensions] = useState({
    width: width,
    height: height,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Update currentDimensions when props change
  useEffect(() => {
    setCurrentDimensions({ width, height });
  }, [width, height]);

  // Load image using scribe-asset:// protocol
  useEffect(() => {
    // Use the custom scribe-asset:// protocol to load images securely
    // This bypasses the file:// security restrictions in Electron
    const assetUrl = `scribe-asset://${assetId}.${ext}`;
    log.debug('Loading image via asset protocol', { assetId, ext, assetUrl });
    setImageSrc(assetUrl);
    setLoadingState('loaded');
  }, [assetId, ext]);

  // Handle image load to get natural dimensions
  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget;
      setNaturalDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });

      // If no explicit dimensions set, update node
      if (!width && !height) {
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isImageNode(node)) {
            node.setDimensions(img.naturalWidth, img.naturalHeight);
          }
        });
      }
    },
    [editor, nodeKey, width, height]
  );

  const handleImageError = useCallback(() => {
    log.error('Image failed to load from asset protocol', { assetId, ext, src: imageSrc });
    setLoadingState('error');
  }, [assetId, ext, imageSrc]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: rect.width,
      height: rect.height,
    });
  }, []);

  useEffect(() => {
    if (!isResizing || !resizeStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.x;
      const aspectRatio = resizeStart.width / resizeStart.height;

      // Resize maintaining aspect ratio
      const newWidth = Math.max(100, resizeStart.width + deltaX);
      const newHeight = newWidth / aspectRatio;

      setCurrentDimensions({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeStart(null);

      // Update node with final dimensions
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node) && currentDimensions.width && currentDimensions.height) {
          node.setDimensions(
            Math.round(currentDimensions.width),
            Math.round(currentDimensions.height)
          );
        }
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart, editor, nodeKey, currentDimensions]);

  const displayWidth = currentDimensions.width || width || naturalDimensions?.width;
  const displayHeight = currentDimensions.height || height || naturalDimensions?.height;

  if (loadingState === 'loading') {
    return (
      <div className={styles.imageContainer}>
        <div className={styles.imagePlaceholder}>
          <span className={styles.loadingText}>Loading image...</span>
        </div>
      </div>
    );
  }

  if (loadingState === 'error') {
    return (
      <div className={styles.imageContainer}>
        <div className={styles.imageError}>
          <span className={styles.errorIcon}>!</span>
          <span className={styles.errorText}>Image not found</span>
          <span className={styles.errorDetail}>{assetId}</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.imageContainer} style={{ position: 'relative' }}>
      <img
        className={styles.image}
        src={imageSrc!}
        alt={alt}
        width={displayWidth}
        height={displayHeight}
        onLoad={handleImageLoad}
        onError={handleImageError}
        draggable={false}
      />
      {loadingState === 'loaded' && (
        <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
      )}
    </div>
  );
}
