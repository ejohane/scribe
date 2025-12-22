import { useCallback } from 'react';
import { ScribeError, logger, getErrorMessage } from '@scribe/shared';

const log = logger.child('useErrorHandler');

/**
 * Return type for the useErrorHandler hook
 */
export interface UseErrorHandlerReturn {
  /**
   * Handle an error by logging it and showing a user-friendly toast notification
   * @param error - The error to handle (can be any type)
   * @param context - Optional context string describing what operation failed (e.g., "Failed to save note")
   */
  handleError: (error: unknown, context?: string) => void;
}

/**
 * Configuration options for the error handler
 */
export interface UseErrorHandlerOptions {
  /**
   * Function to show a toast notification to the user
   * @param message - The user-friendly error message
   * @param type - The type of toast ('success' or 'error')
   */
  showToast: (message: string, type?: 'success' | 'error') => void;
}

/**
 * Default user-friendly message for unknown errors
 */
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Extract a user-friendly message from an error
 *
 * @param error - The error to extract a message from
 * @returns A user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  // Handle ScribeError with proper user messages
  if (error instanceof ScribeError) {
    return error.getUserMessage();
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Only use the error message if it's user-friendly (not a stack trace or technical message)
    // Most Error messages are technical, so we default to the generic message
    return DEFAULT_ERROR_MESSAGE;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Default fallback
  return DEFAULT_ERROR_MESSAGE;
}

/**
 * Custom hook for consistent error handling across the application
 *
 * This hook provides a standardized way to handle errors by:
 * 1. Extracting user-friendly messages from ScribeError instances
 * 2. Logging errors to the console with optional context
 * 3. Showing toast notifications to inform users
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { showToast } = useToast();
 *   const { handleError } = useErrorHandler({ showToast });
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *     } catch (error) {
 *       handleError(error, 'Failed to save');
 *     }
 *   };
 *
 *   return <button onClick={handleSave}>Save</button>;
 * }
 * ```
 *
 * @param options - Configuration options including the showToast function
 * @returns An object containing the handleError function
 */
export function useErrorHandler({ showToast }: UseErrorHandlerOptions): UseErrorHandlerReturn {
  const handleError = useCallback(
    (error: unknown, context?: string) => {
      // Extract user-friendly message
      const userMessage = getUserFriendlyMessage(error);

      // Log error with context for debugging
      log.error(context ?? 'Error', { error: getErrorMessage(error) });

      // Show toast notification to user
      showToast(userMessage, 'error');
    },
    [showToast]
  );

  return { handleError };
}
