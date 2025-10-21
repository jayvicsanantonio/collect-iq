/**
 * Hook for handling API errors consistently across the application
 */

'use client';

import { useCallback } from 'react';
import { type ProblemDetails } from '@/lib/types';
import { formatError, requiresAuth, logError } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';

export interface UseErrorHandlerOptions {
  /**
   * Whether to show a toast notification for errors
   */
  showToast?: boolean;

  /**
   * Whether to automatically redirect on 401 errors
   */
  redirectOnAuth?: boolean;

  /**
   * Custom error handler
   */
  onError?: (problem: ProblemDetails) => void;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const { showToast = true, redirectOnAuth = true, onError } = options;
  const { toast } = useToast();

  const handleError = useCallback(
    (problem: ProblemDetails, context?: Record<string, unknown>) => {
      // Log error for debugging
      logError(problem, context);

      // Format error for display
      const formatted = formatError(problem);

      // Handle authentication errors
      if (requiresAuth(problem) && redirectOnAuth) {
        if (showToast) {
          toast({
            variant: 'destructive',
            title: formatted.title,
            description: formatted.message,
          });
        }

        // Redirect to sign in using Amplify
        setTimeout(async () => {
          try {
            const { signIn } = await import('@/lib/auth');
            await signIn();
          } catch (error) {
            console.error('Failed to redirect to sign in:', error);
          }
        }, 1500);
        return;
      }

      // Show toast notification
      if (showToast) {
        toast({
          variant: 'destructive',
          title: formatted.title,
          description: formatted.message,
        });
      }

      // Call custom error handler
      if (onError) {
        onError(problem);
      }
    },
    [showToast, redirectOnAuth, onError, toast]
  );

  return { handleError };
}
