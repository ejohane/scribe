/**
 * Path manipulation utilities.
 */

/**
 * Extract the file name from a path.
 */
export function getFileName(path: string): string {
  return path.split('/').pop() || '';
}

/**
 * Extract the directory path from a file path.
 */
export function getDirPath(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Get file extension from a path.
 */
export function getExtension(path: string): string {
  const fileName = getFileName(path);
  const lastDot = fileName.lastIndexOf('.');
  return lastDot === -1 ? '' : fileName.slice(lastDot);
}

/**
 * Remove extension from a file name or path.
 */
export function removeExtension(pathOrName: string): string {
  const ext = getExtension(pathOrName);
  return ext ? pathOrName.slice(0, -ext.length) : pathOrName;
}

/**
 * Check if a path is within a specific folder.
 */
export function isInFolder(filePath: string, folderPath: string): boolean {
  return filePath.startsWith(folderPath + '/');
}

/**
 * Join path segments.
 */
export function joinPath(...segments: string[]): string {
  return segments.filter(Boolean).join('/').replace(/\/+/g, '/');
}
