/**
 * Error handling exports
 * Central export point for all error handling utilities
 */

// Error utilities
export {
  getErrorMapping,
  formatError,
  isNetworkError,
  isRetryableError,
  requiresAuth,
  isRateLimitError,
  getRetryDelay,
  logError,
  type FormattedError,
} from './errors';

// API error class
export { ApiError } from './api';

// Error components
export { ErrorAlert } from '@/components/ui/error-alert';
export { ErrorBoundary } from '@/components/ui/error-boundary';
export {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaError,
  RateLimitError,
  ServerError,
} from '@/components/ui/error-states';

// Error handler hook
export { useErrorHandler } from '@/hooks/use-error-handler';

// Toast utilities
export {
  useToast,
  toast,
  success,
  error,
  info,
  loading,
  promise,
} from '@/hooks/use-toast';
