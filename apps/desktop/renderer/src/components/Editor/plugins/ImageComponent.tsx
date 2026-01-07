import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import { $isImageNode, type ImageComponentProps } from './ImageNode';
import { createLogger } from '@scribe/shared';
import * as styles from './ImageComponent.css';
import clsx from 'clsx';

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

  // Fullscreen lightbox state
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Handle image click to open fullscreen
  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't open fullscreen if resizing
      if (isResizing) return;
      e.stopPropagation();
      setIsFullscreen(true);
    },
    [isResizing]
  );

  // Handle closing fullscreen
  const handleCloseLightbox = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Handle keyboard navigation in lightbox
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (!isFullscreen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen]);

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
    <>
      <div ref={containerRef} className={styles.imageContainer} style={{ position: 'relative' }}>
        <img
          className={clsx(styles.image, styles.clickableImage)}
          src={imageSrc!}
          alt={alt}
          width={displayWidth}
          height={displayHeight}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={handleImageClick}
          draggable={false}
        />
        {loadingState === 'loaded' && (
          <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
        )}
      </div>

      {isFullscreen &&
        createPortal(
          <div
            className={styles.lightboxOverlay}
            onClick={handleCloseLightbox}
            role="dialog"
            aria-modal="true"
            aria-label={alt || 'Image preview'}
          >
            <span className={styles.lightboxCloseHint}>Press Esc or click to close</span>
            <img
              className={styles.lightboxImage}
              src={imageSrc!}
              alt={alt}
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}
