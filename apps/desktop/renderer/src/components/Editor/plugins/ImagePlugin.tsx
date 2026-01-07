import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $insertNodes,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_EDITOR,
  DROP_COMMAND,
  PASTE_COMMAND,
  createCommand,
  type LexicalCommand,
  type LexicalNode,
} from 'lexical';
import { $createImageNode, $isImageNode } from './ImageNode';
import { createLogger } from '@scribe/shared';

const log = createLogger({ prefix: 'ImagePlugin' });

// Command for inserting image via slash menu
export const INSERT_IMAGE_COMMAND: LexicalCommand<void> = createCommand('INSERT_IMAGE');

// Supported image extensions for file picker
const IMAGE_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.svg';

const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType);
}

function openImageFilePicker(onFileSelected: (file: File) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = IMAGE_EXTENSIONS;
  input.multiple = false;

  input.onchange = (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
  };

  input.click();
}

/**
 * Recursively collects all image asset IDs from a node tree
 */
function collectImageAssetIds(node: LexicalNode, ids: Set<string>): void {
  if ($isImageNode(node)) {
    ids.add(node.getAssetId());
  }

  if ('getChildren' in node && typeof node.getChildren === 'function') {
    for (const child of (node as { getChildren: () => LexicalNode[] }).getChildren()) {
      collectImageAssetIds(child, ids);
    }
  }
}

/**
 * Deletes an orphaned asset file from the vault
 */
async function deleteAsset(assetId: string): Promise<void> {
  try {
    log.info('Deleting orphaned asset', { assetId });
    const deleted = await window.scribe.assets.delete(assetId);
    if (deleted) {
      log.info('Asset deleted', { assetId });
    } else {
      log.warn('Asset not found for deletion', { assetId });
    }
  } catch (error) {
    log.error('Failed to delete asset', { assetId, error });
    // Don't throw - cleanup failure shouldn't break the editor
  }
}

function getImageFile(dataTransfer: DataTransfer): File | null {
  const { files } = dataTransfer;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (isSupportedImageType(file.type)) {
      return file;
    }
  }
  return null;
}

async function saveAndInsertImage(
  file: File,
  insertImage: (assetId: string, ext: string, alt: string) => void
): Promise<boolean> {
  try {
    log.info('Saving image', { name: file.name, type: file.type, size: file.size });

    const data = await file.arrayBuffer();
    const result = await window.scribe.assets.save(data, file.type, file.name);

    if (result.success && result.assetId && result.ext) {
      log.info('Image saved successfully, inserting into editor', {
        assetId: result.assetId,
        ext: result.ext,
        assetIdLength: result.assetId.length,
      });
      const alt = file.name.replace(/\.[^.]+$/, '') || '';
      insertImage(result.assetId, result.ext, alt);
      return true;
    } else {
      log.error('Image save failed', { error: result.error });
      return false;
    }
  } catch (error) {
    log.error('Failed to save image', { error });
    return false;
  }
}

export function ImagePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const insertImage = (assetId: string, ext: string, alt: string) => {
      editor.update(() => {
        const selection = $getSelection();

        // Create the image node with ext
        const imageNode = $createImageNode(assetId, alt, ext);

        if ($isRangeSelection(selection)) {
          $insertNodes([imageNode, $createParagraphNode()]);
        } else {
          const root = $getSelection()?.getNodes()[0]?.getTopLevelElement();
          if (root) {
            root.insertAfter(imageNode);
            imageNode.insertAfter($createParagraphNode());
          }
        }
      });
    };

    const unregisterDrop = editor.registerCommand(
      DROP_COMMAND,
      (event: DragEvent) => {
        const { dataTransfer } = event;
        if (!dataTransfer) return false;

        const imageFile = getImageFile(dataTransfer);
        if (!imageFile) return false;

        event.preventDefault();
        saveAndInsertImage(imageFile, insertImage);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const unregisterPaste = editor.registerCommand(
      PASTE_COMMAND,
      (event: ClipboardEvent) => {
        const { clipboardData } = event;
        if (!clipboardData) return false;

        const imageFile = getImageFile(clipboardData);
        if (!imageFile) return false;

        event.preventDefault();
        saveAndInsertImage(imageFile, insertImage);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );

    const unregisterInsertImage = editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      () => {
        openImageFilePicker(async (file) => {
          await saveAndInsertImage(file, insertImage);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR
    );

    // Cleanup: detect removed images and delete assets
    const unregisterUpdateListener = editor.registerUpdateListener(
      ({ editorState, prevEditorState }) => {
        // Get current image asset IDs
        const currentAssetIds = new Set<string>();
        editorState.read(() => {
          collectImageAssetIds($getRoot(), currentAssetIds);
        });

        // Get previous image asset IDs
        const prevAssetIds = new Set<string>();
        prevEditorState.read(() => {
          collectImageAssetIds($getRoot(), prevAssetIds);
        });

        // Find removed asset IDs and delete them
        for (const assetId of prevAssetIds) {
          if (!currentAssetIds.has(assetId)) {
            deleteAsset(assetId);
          }
        }
      }
    );

    return () => {
      unregisterDrop();
      unregisterPaste();
      unregisterInsertImage();
      unregisterUpdateListener();
    };
  }, [editor]);

  return null;
}

export default ImagePlugin;
