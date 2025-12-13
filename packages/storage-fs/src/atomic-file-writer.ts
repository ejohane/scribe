/**
 * Atomic file writer for crash-safe I/O operations
 *
 * Provides atomic write operations that ensure no partial writes on crash
 * or power loss by using a temp file → fsync → rename pattern.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ErrorCode, ScribeError } from '@scribe/shared';

/**
 * Options for atomic write operations
 */
export interface AtomicWriteOptions {
  /**
   * Custom temp file suffix (default: '.tmp')
   * The temp file will be named `.{basename}{suffix}` in the same directory
   */
  tempSuffix?: string;
}

/**
 * Interface for atomic file writing operations
 */
export interface IAtomicFileWriter {
  /**
   * Write string content to a file atomically
   *
   * @param filePath - Final file path
   * @param content - String content to write
   * @param options - Optional write options
   * @throws ScribeError if write fails
   */
  write(filePath: string, content: string, options?: AtomicWriteOptions): Promise<void>;

  /**
   * Write JSON data to a file atomically
   *
   * @param filePath - Final file path
   * @param data - Data to serialize as JSON
   * @param options - Optional write options
   * @throws ScribeError if write fails
   */
  writeJson<T>(filePath: string, data: T, options?: AtomicWriteOptions): Promise<void>;
}

/**
 * Atomic file writer implementation
 *
 * Writes to a temporary file, syncs to disk, then renames to final path.
 * This ensures no partial writes on crash or power loss.
 *
 * Pattern:
 * 1. Write content to temporary file (.filename.tmp)
 * 2. Open file handle and call fsync() to ensure data is physically written
 * 3. Atomic rename from temp to final path
 * 4. On error, clean up temp file
 *
 * This approach is safe because:
 * - The rename operation is atomic on POSIX filesystems
 * - fsync ensures data durability before rename
 * - Original file remains intact if write fails
 */
export class AtomicFileWriter implements IAtomicFileWriter {
  private readonly defaultTempSuffix = '.tmp';

  /**
   * Generate the temp file path for a given target path
   *
   * @param filePath - Target file path
   * @param suffix - Temp file suffix
   * @returns Temp file path in the same directory as target
   */
  private getTempPath(filePath: string, suffix: string): string {
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath);
    return path.join(dir, `.${basename}${suffix}`);
  }

  /**
   * Clean up a temp file, ignoring errors if it doesn't exist
   *
   * @param tempPath - Path to the temp file to clean up
   */
  private async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors - temp file may not exist
    }
  }

  /**
   * Write string content to a file atomically
   *
   * Uses the temp file → fsync → rename pattern to ensure crash safety.
   *
   * @param filePath - Final file path
   * @param content - String content to write
   * @param options - Optional write options
   * @throws ScribeError if write fails
   */
  async write(filePath: string, content: string, options?: AtomicWriteOptions): Promise<void> {
    const suffix = options?.tempSuffix ?? this.defaultTempSuffix;
    const tempPath = this.getTempPath(filePath, suffix);

    try {
      // Write to temporary file
      await fs.writeFile(tempPath, content, 'utf-8');

      // Sync to disk (ensure data is physically written)
      const fileHandle = await fs.open(tempPath, 'r+');
      try {
        await fileHandle.sync();
      } finally {
        await fileHandle.close();
      }

      // Atomic rename
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      await this.cleanupTempFile(tempPath);

      // Wrap and rethrow with ScribeError
      const err = error as Error & { code?: string };
      const code = ScribeError.fromSystemError(err, ErrorCode.FILE_WRITE_ERROR);
      throw new ScribeError(code, `Failed to write file ${filePath}: ${err.message}`, err);
    }
  }

  /**
   * Write JSON data to a file atomically
   *
   * Serializes the data as formatted JSON and writes atomically.
   *
   * @param filePath - Final file path
   * @param data - Data to serialize as JSON
   * @param options - Optional write options
   * @throws ScribeError if write fails
   */
  async writeJson<T>(filePath: string, data: T, options?: AtomicWriteOptions): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    return this.write(filePath, content, options);
  }
}

/**
 * Default singleton instance of AtomicFileWriter
 *
 * Use this for most cases. Create a new instance only if you need
 * custom configuration or isolated testing.
 */
export const atomicFileWriter = new AtomicFileWriter();
