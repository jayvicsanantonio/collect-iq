# Error Handling Guide

This guide explains how to use the CollectIQ error handling system throughout the application.

## Overview

The error handling system is built on RFC 7807 ProblemDetails format and provides:

- Consistent error parsing and formatting
- User-friendly error messages with remediation guidance
- Toast notifications for inline feedback
- Full-page error states for critical errors
- Automatic retry logic for transient failures
- Request ID tracking for debugging

## Quick Start

### 1. Handling API Errors

```typescript
import { useErrorHandler } from '@/hooks/use-error-handler';
import { api } from '@/lib/api';

function MyComponent() {
  const { handleError } = useErrorHandler();

  async function loadData() {
    try {
      const data = await api.getCards();
      // Use data...
    } catch (error) {
      if (error instanceof ApiError && error.problem) {
        handleError(error.problem);
      }
    }
  }
}
```

### 2. Showing Toast Notifications

```typescript
import { success, error, info } from '@/hooks/use-toast';

// Success toast
success('Card saved to vault successfully!');

// Error toast
error('Failed to upload image. Please try again.');

// Info toast
info('Valuation data is being refreshed.');
```

### 3. Using Error State Components

```typescript
import { NotFoundError, ServerError } from '@/components/ui/error-states';

function CardDetailPage() {
  if (notFound) {
    return <NotFoundError resourceType="card" />;
  }

  if (serverError) {
    return <ServerError onRetry={refetch} />;
  }

  // Render normal content...
}
```

## Error Components

### ErrorAlert

Inline alert component for displaying errors within a page:

```typescript
import { ErrorAlert } from '@/components/ui/error-alert';
import { formatError } from '@/lib/errors';

<ErrorAlert
  variant="error"
  title={formatted.title}
  message={formatted.message}
  remediation={formatted.remediation}
  onRetry={handleRetry}
  onDismiss={handleDismiss}
/>
```

### Error States

Full-page error components for specific HTTP errors:

- `UnauthorizedError` (401) - Redirects to Cognito Hosted UI
- `ForbiddenError` (403) - Access denied message
- `NotFoundError` (404) - Resource not found
- `PayloadTooLargeError` (413) - File too large
- `UnsupportedMediaError` (415) - Unsupported file type
- `RateLimitError` (429) - Rate limit with countdown
- `ServerError` (5xx) - Server error with retry

### ErrorBoundary

React error boundary for catching unexpected errors:

```typescript
import { ErrorBoundary } from '@/components/ui/error-boundary';

<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

## Error Utilities

### formatError

Format ProblemDetails for user display:

```typescript
import { formatError } from '@/lib/errors';

const formatted = formatError(problem);
// Returns: { title, message, remediation, retryable, requestId, status, type }
```

### Error Checking

```typescript
import { isRetryableError, requiresAuth, isRateLimitError } from '@/lib/errors';

if (requiresAuth(problem)) {
  // Redirect to sign in
}

if (isRetryableError(problem)) {
  // Show retry button
}

if (isRateLimitError(problem)) {
  // Show countdown timer
}
```

## Toast Patterns

### Promise-based Toasts

```typescript
import { promise } from '@/hooks/use-toast';

await promise(
  api.createCard(data),
  {
    loading: 'Saving card...',
    success: 'Card saved successfully!',
    error: 'Failed to save card',
  }
);
```

### Dynamic Messages

```typescript
await promise(
  api.createCard(data),
  {
    loading: 'Saving card...',
    success: (card) => `${card.name} saved to vault!`,
    error: (err) => err.message || 'Failed to save card',
  }
);
```

### Manual Control

```typescript
import { loading, success, error } from '@/hooks/use-toast';

const loadingToast = loading('Processing...');

try {
  await doSomething();
  loadingToast.dismiss();
  success('Done!');
} catch (err) {
  loadingToast.dismiss();
  error('Failed!');
}
```

## Common Patterns

### Upload Flow

```typescript
import { success, error } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';

async function handleUpload(file: File) {
  try {
    // Get presigned URL
    const presign = await api.getPresignedUrl({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });

    // Upload to S3
    await uploadToS3(presign.uploadUrl, file);

    // Create card record
    const card = await api.createCard({
      frontS3Key: presign.key,
    });

    success(`${card.name || 'Card'} uploaded successfully!`);
    return card;
  } catch (err) {
    if (err instanceof ApiError && err.problem) {
      const formatted = formatError(err.problem);
      error(formatted.message, formatted.title);
    } else {
      error('Failed to upload card. Please try again.');
    }
    throw err;
  }
}
```

### Delete with Confirmation

```typescript
import { success, error } from '@/hooks/use-toast';
import { api, ApiError } from '@/lib/api';

async function handleDelete(cardId: string, cardName: string) {
  try {
    await api.deleteCard(cardId);
    success(`${cardName} removed from vault`);
  } catch (err) {
    if (err instanceof ApiError && err.problem) {
      const formatted = formatError(err.problem);
      error(formatted.message, formatted.title);
    } else {
      error('Failed to delete card. Please try again.');
    }
  }
}
```

### Refresh with Loading State

```typescript
import { promise } from '@/hooks/use-toast';
import { api } from '@/lib/api';

async function handleRefresh(cardId: string) {
  await promise(
    api.revalueCard(cardId, { forceRefresh: true }),
    {
      loading: 'Refreshing valuation...',
      success: 'Valuation updated successfully!',
      error: 'Failed to refresh valuation',
    }
  );
}
```

## Error Mapping

The system automatically maps HTTP status codes to user-friendly messages:

| Status | Title | Message | Retryable |
|--------|-------|---------|-----------|
| 400 | Invalid Request | The request contains invalid data | No |
| 401 | Session Expired | Your session has expired | No |
| 403 | Access Denied | You don't have permission | No |
| 404 | Not Found | Resource was not found | No |
| 413 | File Too Large | Image is too large (max 12 MB) | No |
| 415 | Unsupported File Type | Use JPG, PNG, or HEIC | No |
| 429 | Rate Limit Exceeded | Too many requests | Yes |
| 500 | Server Error | Something went wrong | Yes |
| 502 | Bad Gateway | Unable to connect | Yes |
| 503 | Service Unavailable | Service temporarily unavailable | Yes |

## Best Practices

1. **Always handle API errors**: Wrap API calls in try-catch blocks
2. **Use appropriate error components**: Choose between inline alerts and full-page states
3. **Provide remediation**: Tell users what they can do to fix the issue
4. **Show success feedback**: Confirm successful actions with toasts
5. **Enable retry for transient errors**: Allow users to retry failed operations
6. **Track request IDs**: Include requestId in error logs for debugging
7. **Never log PII**: Avoid logging sensitive user information

## Examples

See `lib/toast-examples.ts` for comprehensive usage examples.

## API Reference

### Error Handler Hook

```typescript
const { handleError } = useErrorHandler({
  showToast: true,        // Show toast notifications
  redirectOnAuth: true,   // Auto-redirect on 401
  onError: (problem) => { // Custom error handler
    // Handle error
  },
});
```

### Toast Functions

```typescript
// Basic toasts
success(message: string, title?: string)
error(message: string, title?: string)
info(message: string, title?: string)
loading(message: string, title?: string)

// Promise-based toast
promise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  }
): Promise<T>

// Advanced toast
toast({
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
  action?: ToastActionElement;
})
```

### Error Utilities

```typescript
// Format error for display
formatError(problem: ProblemDetails): FormattedError

// Check error type
isNetworkError(problem: ProblemDetails): boolean
isRetryableError(problem: ProblemDetails): boolean
requiresAuth(problem: ProblemDetails): boolean
isRateLimitError(problem: ProblemDetails): boolean

// Get retry delay (for rate limits)
getRetryDelay(): number

// Log error (without PII)
logError(problem: ProblemDetails, context?: Record<string, unknown>): void
```
