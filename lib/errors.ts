/**
 * Error handling utilities for CollectIQ frontend
 * Implements RFC 7807 ProblemDetails error handling with user-friendly messages
 */

import { type ProblemDetails } from '@/lib/types';

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * User-friendly error messages with remediation guidance
 */
interface ErrorMapping {
  title: string;
  message: string;
  remediation: string;
  retryable: boolean;
}

/**
 * Map HTTP status codes to user-friendly messages
 */
export function getErrorMapping(problem: ProblemDetails): ErrorMapping {
  const status = problem.status;

  switch (status) {
    case 400:
      return {
        title: 'Invalid Request',
        message: problem.detail || 'The request contains invalid data.',
        remediation: 'Please check your input and try again.',
        retryable: false,
      };

    case 401:
      return {
        title: 'Session Expired',
        message: 'Your session has expired. Please sign in again.',
        remediation: 'You will be redirected to sign in.',
        retryable: false,
      };

    case 403:
      return {
        title: 'Access Denied',
        message: "You don't have permission to access this resource.",
        remediation: 'Please contact support if you believe this is an error.',
        retryable: false,
      };

    case 404:
      return {
        title: 'Not Found',
        message: problem.detail || 'The requested resource was not found.',
        remediation: 'Please check the URL and try again.',
        retryable: false,
      };

    case 413:
      return {
        title: 'File Too Large',
        message: 'The image you selected is too large.',
        remediation: 'Please upload a file under 12 MB.',
        retryable: false,
      };

    case 415:
      return {
        title: 'Unsupported File Type',
        message: 'The file type you selected is not supported.',
        remediation: 'Please use JPG, PNG, or HEIC format.',
        retryable: false,
      };

    case 429:
      return {
        title: 'Rate Limit Exceeded',
        message: 'You have made too many requests.',
        remediation: 'Please wait a moment before trying again.',
        retryable: true,
      };

    case 500:
      return {
        title: 'Server Error',
        message: 'Something went wrong on our end.',
        remediation: 'Please try again in a moment.',
        retryable: true,
      };

    case 502:
      return {
        title: 'Bad Gateway',
        message: 'Unable to connect to the server.',
        remediation: 'Please try again in a moment.',
        retryable: true,
      };

    case 503:
      return {
        title: 'Service Unavailable',
        message: 'The service is temporarily unavailable.',
        remediation: 'Please try again in a few minutes.',
        retryable: true,
      };

    default:
      return {
        title: problem.title || 'Request Failed',
        message: problem.detail || 'An unexpected error occurred.',
        remediation: 'Please try again or contact support if the problem persists.',
        retryable: status >= 500,
      };
  }
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format ProblemDetails for display to users
 */
export interface FormattedError {
  title: string;
  message: string;
  remediation: string;
  retryable: boolean;
  requestId?: string;
  status: number;
  type: string;
}

/**
 * Format a ProblemDetails error for user display
 */
export function formatError(problem: ProblemDetails): FormattedError {
  const mapping = getErrorMapping(problem);

  return {
    title: mapping.title,
    message: mapping.message,
    remediation: mapping.remediation,
    retryable: mapping.retryable,
    requestId: problem.requestId,
    status: problem.status,
    type: problem.type,
  };
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if an error is a network error (no status code)
 */
export function isNetworkError(problem: ProblemDetails): boolean {
  return problem.status === 0;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(problem: ProblemDetails): boolean {
  const mapping = getErrorMapping(problem);
  return mapping.retryable;
}

/**
 * Check if an error requires authentication
 */
export function requiresAuth(problem: ProblemDetails): boolean {
  return problem.status === 401;
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(problem: ProblemDetails): boolean {
  return problem.status === 429;
}

/**
 * Get retry delay for rate limit errors (in seconds)
 * Returns default delay (could be extended to parse Retry-After header)
 */
export function getRetryDelay(): number {
  // Default retry delay for rate limit errors
  return 60; // 60 seconds
}

// ============================================================================
// Error Logging
// ============================================================================

/**
 * Log error for debugging (without PII)
 */
export function logError(problem: ProblemDetails, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', {
      type: problem.type,
      title: problem.title,
      status: problem.status,
      detail: problem.detail,
      requestId: problem.requestId,
      context,
    });
  }

  // In production, send to error tracking service (e.g., Sentry)
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(new Error(problem.title), {
  //     extra: {
  //       problemDetails: problem,
  //       context,
  //     },
  //   });
  // }
}
