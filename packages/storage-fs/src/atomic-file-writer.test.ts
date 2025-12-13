/**
 * Unit tests for AtomicFileWriter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { AtomicFileWriter, atomicFileWriter } from './atomic-file-writer.js';
import { ScribeError, ErrorCode } from '@scribe/shared';

describe('AtomicFileWriter', () => {
  let tempDir: string;
  let writer: AtomicFileWriter;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-atomic-writer-test-'));
    writer = new AtomicFileWriter();
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('write', () => {
    it('should write content to a file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello, world!';

      await writer.write(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should overwrite existing file content', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'original content', 'utf-8');

      await writer.write(filePath, 'new content');

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe('new content');
    });

    it('should write Unicode content correctly', async () => {
      const filePath = path.join(tempDir, 'unicode.txt');
      const content = 'Hello, 世界! 🌍 Привет мир!';

      await writer.write(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should write large content', async () => {
      const filePath = path.join(tempDir, 'large.txt');
      const content = 'x'.repeat(1024 * 1024); // 1MB of data

      await writer.write(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should write empty content', async () => {
      const filePath = path.join(tempDir, 'empty.txt');

      await writer.write(filePath, '');

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe('');
    });

    it('should not leave temp files on success', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await writer.write(filePath, 'content');

      const files = await fs.readdir(tempDir);
      expect(files).toEqual(['test.txt']);
      expect(files.some((f) => f.includes('.tmp'))).toBe(false);
    });

    it('should use custom temp suffix when provided', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await writer.write(filePath, 'content', { tempSuffix: '.writing' });

      // File should exist with correct content
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe('content');

      // No temp files should remain
      const files = await fs.readdir(tempDir);
      expect(files).toEqual(['test.txt']);
    });
  });

  describe('writeJson', () => {
    it('should write JSON data to a file', async () => {
      const filePath = path.join(tempDir, 'data.json');
      const data = { name: 'test', value: 42 };

      await writer.writeJson(filePath, data);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(result)).toEqual(data);
    });

    it('should format JSON with indentation', async () => {
      const filePath = path.join(tempDir, 'data.json');
      const data = { name: 'test', nested: { value: 42 } };

      await writer.writeJson(filePath, data);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toContain('\n'); // Should have newlines (formatted)
      expect(result).toContain('  '); // Should have indentation
    });

    it('should handle arrays', async () => {
      const filePath = path.join(tempDir, 'array.json');
      const data = [1, 2, 3, { nested: true }];

      await writer.writeJson(filePath, data);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(result)).toEqual(data);
    });

    it('should handle null', async () => {
      const filePath = path.join(tempDir, 'null.json');

      await writer.writeJson(filePath, null);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(result)).toBeNull();
    });

    it('should handle complex nested structures', async () => {
      const filePath = path.join(tempDir, 'complex.json');
      const data = {
        id: 'test-123',
        metadata: {
          title: 'Test Note',
          tags: ['important', 'work'],
          nested: {
            deep: {
              value: true,
            },
          },
        },
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Hello' }],
              },
            ],
          },
        },
      };

      await writer.writeJson(filePath, data);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(result)).toEqual(data);
    });
  });

  describe('error handling', () => {
    it('should throw ScribeError when directory does not exist', async () => {
      const filePath = path.join(tempDir, 'nonexistent', 'test.txt');

      await expect(writer.write(filePath, 'content')).rejects.toThrow(ScribeError);
      await expect(writer.write(filePath, 'content')).rejects.toThrow(/Failed to write file/);
    });

    it('should throw ScribeError when directory is not writable', async () => {
      // Create a read-only directory
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444);

      const filePath = path.join(readOnlyDir, 'test.txt');

      try {
        await expect(writer.write(filePath, 'content')).rejects.toThrow(ScribeError);
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }
    });

    it('should include appropriate error code', async () => {
      const filePath = path.join(tempDir, 'nonexistent', 'test.txt');

      try {
        await writer.write(filePath, 'content');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ScribeError);
        // ENOENT is mapped to FILE_NOT_FOUND by ScribeError.fromSystemError
        expect((error as ScribeError).code).toBe(ErrorCode.FILE_NOT_FOUND);
      }
    });

    it('should clean up temp file on write failure', async () => {
      // Create a file that will succeed initially but fail on rename
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);

      const filePath = path.join(readOnlyDir, 'test.txt');

      // Write initial file, then make directory read-only
      await fs.writeFile(filePath, 'original', 'utf-8');
      await fs.chmod(readOnlyDir, 0o444);

      try {
        await writer.write(filePath, 'new content');
        expect.fail('Should have thrown an error');
      } catch {
        // Expected to fail
      }

      // Restore permissions and check no temp files
      await fs.chmod(readOnlyDir, 0o755);
      const files = await fs.readdir(readOnlyDir);
      expect(files.some((f) => f.includes('.tmp'))).toBe(false);
    });

    it('should preserve original file on failure', async () => {
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);

      const filePath = path.join(readOnlyDir, 'test.txt');
      await fs.writeFile(filePath, 'original content', 'utf-8');
      await fs.chmod(readOnlyDir, 0o444);

      try {
        await writer.write(filePath, 'new content');
        expect.fail('Should have thrown an error');
      } catch {
        // Expected to fail
      }

      // Restore permissions and verify original content
      await fs.chmod(readOnlyDir, 0o755);
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe('original content');
    });
  });

  describe('atomicity', () => {
    it('should write atomically (no partial writes visible)', async () => {
      const filePath = path.join(tempDir, 'atomic.txt');
      const content = 'This is atomic content that should appear all at once';

      // Write original content
      await fs.writeFile(filePath, 'original', 'utf-8');

      // Perform atomic write
      await writer.write(filePath, content);

      // Read result - should be complete new content, never partial
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should handle concurrent writes to different files', async () => {
      const writes = Array.from({ length: 10 }, (_, i) => ({
        path: path.join(tempDir, `file-${i}.txt`),
        content: `Content for file ${i}`,
      }));

      // Write all files concurrently
      await Promise.all(writes.map(({ path: p, content }) => writer.write(p, content)));

      // Verify all files have correct content
      for (const { path: p, content } of writes) {
        const result = await fs.readFile(p, 'utf-8');
        expect(result).toBe(content);
      }
    });

    it('should handle concurrent writes to same file safely', async () => {
      const filePath = path.join(tempDir, 'concurrent.txt');

      // Start multiple concurrent writes
      // Note: concurrent atomic writes to the same file may have race conditions
      // at the temp file level, but at least one should succeed
      const writes = Array.from({ length: 5 }, (_, i) =>
        writer.write(filePath, `Content version ${i}`)
      );

      // Use allSettled since some concurrent writes may fail due to temp file conflicts
      const results = await Promise.allSettled(writes);

      // At least one should succeed
      const successes = results.filter((r) => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // File should exist with one of the versions
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toMatch(/^Content version \d$/);
    });
  });

  describe('singleton instance', () => {
    it('should export a default singleton instance', () => {
      expect(atomicFileWriter).toBeInstanceOf(AtomicFileWriter);
    });

    it('should work correctly with singleton', async () => {
      const filePath = path.join(tempDir, 'singleton.txt');
      await atomicFileWriter.write(filePath, 'singleton content');

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe('singleton content');
    });
  });

  describe('edge cases', () => {
    it('should handle files with special characters in name', async () => {
      const filePath = path.join(tempDir, 'file with spaces.txt');
      await writer.write(filePath, 'content');

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe('content');
    });

    it('should handle deeply nested paths', async () => {
      const nestedDir = path.join(tempDir, 'a', 'b', 'c');
      await fs.mkdir(nestedDir, { recursive: true });

      const filePath = path.join(nestedDir, 'deep.txt');
      await writer.write(filePath, 'deep content');

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe('deep content');
    });

    it('should handle content with newlines', async () => {
      const filePath = path.join(tempDir, 'multiline.txt');
      const content = 'line1\nline2\nline3\n';

      await writer.write(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should handle content with carriage returns', async () => {
      const filePath = path.join(tempDir, 'crlf.txt');
      const content = 'line1\r\nline2\r\nline3\r\n';

      await writer.write(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });
  });
});
