/**
 * useVaultPath Hook
 *
 * Manages vault path state: fetching current path, tracking loading/error states,
 * and providing methods to change vaults.
 */

import { useState, useEffect, useCallback } from 'react';
import type { VaultSwitchResult, VaultCreateResult, VaultValidationResult } from '@scribe/shared';
import { createLogger, getErrorMessage } from '@scribe/shared';

const log = createLogger({ prefix: 'useVaultPath' });

export interface UseVaultPathReturn {
  /** Current vault path */
  path: string | null;
  /** Whether the vault path is currently loading */
  isLoading: boolean;
  /** Error message if any operation failed */
  error: string | null;
  /** Refresh the vault path from the main process */
  refresh: () => Promise<void>;
  /** Set a new vault path (requires restart) */
  setVaultPath: (newPath: string) => Promise<VaultSwitchResult>;
  /** Create a new vault at the specified path */
  createVault: (newPath: string) => Promise<VaultCreateResult>;
  /** Validate if a path is a valid vault */
  validatePath: (path: string) => Promise<VaultValidationResult>;
  /** Whether the vault path is valid (loaded without error) */
  isValid: boolean;
}

/**
 * Hook for managing vault path state
 *
 * @example
 * const { path, isLoading, error } = useVaultPath();
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error} />;
 * return <PathDisplay path={path} />;
 */
export function useVaultPath(): UseVaultPathReturn {
  const [path, setPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const currentPath = await window.scribe.vault.getPath();
      setPath(currentPath);
    } catch (err) {
      setError('Failed to load vault path');
      log.error('Failed to load vault path', { error: getErrorMessage(err) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch current vault path on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const setVaultPath = useCallback(async (newPath: string): Promise<VaultSwitchResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.scribe.vault.setPath(newPath);
      if (result.success) {
        setPath(result.path);
      } else {
        setError(result.error || 'Failed to switch vault');
      }
      return result;
    } catch (err) {
      const errorMsg = 'Failed to switch vault';
      setError(errorMsg);
      log.error('Failed to switch vault', { error: getErrorMessage(err), path: newPath });
      return { success: false, path: newPath, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createVault = useCallback(async (newPath: string): Promise<VaultCreateResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.scribe.vault.create(newPath);
      if (result.success) {
        setPath(result.path);
      } else {
        setError(result.error || 'Failed to create vault');
      }
      return result;
    } catch (err) {
      const errorMsg = 'Failed to create vault';
      setError(errorMsg);
      log.error('Failed to create vault', { error: getErrorMessage(err), path: newPath });
      return { success: false, path: newPath, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validatePath = useCallback(
    async (pathToValidate: string): Promise<VaultValidationResult> => {
      try {
        return await window.scribe.vault.validate(pathToValidate);
      } catch (err) {
        log.error('Failed to validate vault path', {
          error: getErrorMessage(err),
          path: pathToValidate,
        });
        return { valid: false, missingDirs: ['unknown'] };
      }
    },
    []
  );

  return {
    path,
    isLoading,
    error,
    refresh,
    setVaultPath,
    createVault,
    validatePath,
    isValid: path !== null && !error,
  };
}
