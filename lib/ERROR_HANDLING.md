# Error Handling Guide

This document describes the error handling system implemented in the CollectIQ frontend.

## Overview

The error handling system follows RFC 7807 ProblemDetails format and provides:

- Consistent error parsing and formatting
- User-friendly error messages with remediation guidance
- Automatic handling of common HTTP errors (401, 403, 404, 413, 415, 429, 5xx)
- Toast notifications for inline feedback
- Full-page error states for critical errors
- Request ID tracking for debugging

## Architecture

```
API Error → ProblemDetails → Error Mapping → User Display
                ↓
          Error Logging
```

## Core Components

### 1. Error Handler (`lib/errors.ts`)

Central error handling utilities:

```typescript
import { formatError, requiresAuth, isRetryableError } from '@/lib/errors';

// Format error for display
const formatted = formatError(problemDetails);
console.log(formatted.title, formatted.message, formatted.remediation);

// Check error type
if (requiresAuth(problemDetails)) {
  // Redirect to auth
}

if (isRetryableError(problemDetails)) {
  // Show retry button
}
```

### 2. API Client (`lib/api.ts`)

The API client automatically:
- Parses ProblemDetails from error responses
- Implements exponential backoff retry for retryable errors
- Includes request IDs for traceability
- Throws `ApiError` with structured error information

```typescript
import { api, ApiError } from '@/lib/api';

try {
  const card = await api.getCard(cardId);
} catch (error) {
  if (error instanceof ApiError) {
    console.log(error.problem.status); // HTTP status
    console.log(error.problem.detail); // Error message
    console.log(error.problem.requestId); // Request ID
    
    // Check error type
    if (error.requiresAuth()) {
      // Handle auth error
    }
  }
}
```

### 3. Error Alert Component (`components/ui/error-alert.tsx`)

Inline error display with optional retry/dismiss actions:

```tsx
import { ErrorAlert } from '@/components/ui/error-alert';

<ErrorAlert
  variant="error" // error | warning | info
  title="Upload Failed"
  message="The image could not be uploaded"
  remediation="Please check your connection and try again"
  onRetry={() => handleRetry()}
  onDismiss={() => setError(null)}
/>
```

### 4. Error States (`components/ui/error-states.tsx`)

Full-page error states for specific scenarios:

```tsx
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaError,
  RateLimitError,
  ServerError,
} from '@/components/ui/error-states';

// 401 - Automatically redirects to auth
<UnauthorizedError />

// 403 - Access denied
<ForbiddenError />

// 404 - Resource not found
<NotFoundError resourceType="card" />

// 413 - File too large
<PayloadTooLargeError onRetry={() => handleRetry()} />

// 415 - Unsupported media type
<UnsupportedMediaError onRetry={() => handleRetry()} />

// 429 - Rate limit with countdown
<RateLimitError retryAfter={60} onRetry={() => handleRetry()} />

// 5xx - Server error
<ServerError onRetry={() => handleRetry()} />
```

### 5. Error Handler Hook (`hooks/use-error-handler.ts`)

React hook for consistent error handling:

```tsx
import { useErrorHandler } from '@/hooks/use-error-handler';

function MyComponent() {
  const { handleError } = useErrorHandler({
    showToast: true,
    redirectOnAuth: true,
  });

  async function loadData() {
    try {
      const data = await api.getCards();
    } catch (error) {
      if (error instanceof ApiError) {
        handleError(error.problem);
      }
    }
  }
}
```

### 6. Error Boundary (`components/ui/error-boundary.tsx`)

Catches React errors and displays fallback UI:

```tsx
import { ErrorBoundary } from '@/components/ui/error-boundary';

<ErrorBoundary>
  <MyComponent />
</ErrorBoundary>
```

## Toast Notifications

### Basic Usage

```typescript
import { success, error, info, loading } from '@/hooks/use-toast';

// Success toast
success('Card saved to vault!');

// Error toast
error('Failed to upload image');

// Info toast
info('Valuation is being refreshed');

// Loading toast (doesn't auto-dismiss)
const loadingToast = loading('Uploading...');
// Later...
loadingToast.dismiss();
```

### Promise-based Toasts

```typescript
import { promise } from '@/hooks/use-toast';

await promise(
  uploadFile(file),
  {
    loading: 'Uploading image...',
    success: 'Image uploaded successfully!',
    error: 'Failed to upload image',
  }
);

// With dynamic messages
await promise(
  saveCard(card),
  {
    loading: 'Saving card...',
    success: (data) => `${data.name} saved!`,
    error: (err) => err.message,
  }
);
```

### Toast with Actions

```typescript
import { toast } from '@/hooks/use-toast';

toast({
  title: 'Card deleted',
  description: 'The card has been removed',
  action: {
    label: 'Undo',
    onClick: () => restoreCard(),
  },
});
```

## Error Mapping

The system automatically maps HTTP status codes to user-friendly messages:

| Status | Title | Message | Retryable |
|--------|-------|---------|-----------|
| 400 | Invalid Request | The request contains invalid data | No |
| 401 | Session Expired | Your session has expired | No (redirects) |
| 403 | Access Denied | You don't have permission | No |
| 404 | Not Found | Resource was not found | No |
| 413 | File Too Large | Image is too large (max 12 MB) | No |
| 415 | Unsupported File Type | Use JPG, PNG, or HEIC | No |
| 429 | Rate Limit Exceeded | Too many requests | Yes |
| 500 | Server Error | Something went wrong | Yes |
| 502 | Bad Gateway | Unable to connect | Yes |
| 503 | Service Unavailable | Service temporarily unavailable | Yes |

## Usage Patterns

### Pattern 1: API Call with Toast

```tsx
import { useErrorHandler } from '@/hooks/use-error-handler';
import { success } from '@/hooks/use-toast';

function MyComponent() {
  const { handleError } = useErrorHandler();

  async function saveCard() {
    try {
      await api.createCard(data);
      success('Card saved successfully!');
    } catch (error) {
      if (error instanceof ApiError) {
        handleError(error.problem);
      }
    }
  }
}
```

### Pattern 2: Full-Page Error State

```tsx
import { useState } from 'react';
import { NotFoundError, ServerError } from '@/components/ui/error-states';

function CardDetailPage({ cardId }: { cardId: string }) {
  const [error, setError] = useState<ProblemDetails | null>(null);

  if (error?.status === 404) {
    return <NotFoundError resourceType="card" />;
  }

  if (error?.status >= 500) {
    return <ServerError onRetry={() => loadCard()} />;
  }

  // Normal render
}
```

### Pattern 3: Inline Error Alert

```tsx
import { useState } from 'react';
import { ErrorAlert } from '@/components/ui/error-alert';
import { formatError } from '@/lib/errors';

function UploadForm() {
  const [error, setError] = useState<ProblemDetails | null>(null);

  if (error) {
    const formatted = formatError(error);
    return (
      <ErrorAlert
        variant="error"
        title={formatted.title}
        message={formatted.message}
        remediation={formatted.remediation}
        onRetry={formatted.retryable ? handleRetry : undefined}
        onDismiss={() => setError(null)}
      />
    );
  }

  // Normal render
}
```

### Pattern 4: Promise Toast

```tsx
import { promise } from '@/hooks/use-toast';

async function uploadCard(file: File) {
  return promise(
    api.uploadFile(file),
    {
      loading: 'Uploading card...',
      success: 'Card uploaded successfully!',
      error: 'Failed to upload card',
    }
  );
}
```

## Best Practices

1. **Always use ProblemDetails format** - The API client automatically parses errors into this format
2. **Show user-friendly messages** - Use `formatError()` to get remediation guidance
3. **Handle auth errors automatically** - Use `useErrorHandler` with `redirectOnAuth: true`
4. **Provide retry for retryable errors** - Check `isRetryableError()` or `formatted.retryable`
5. **Include request IDs** - Automatically tracked for debugging
6. **Never log PII** - The error logging system strips sensitive data
7. **Use appropriate error display** - Toast for inline, full-page for critical errors
8. **Test error states** - Verify all error scenarios are handled gracefully

## Testing

```typescript
import { formatError, getErrorMapping } from '@/lib/errors';

describe('Error Handling', () => {
  it('formats 404 errors correctly', () => {
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      detail: 'Card not found',
    };

    const formatted = formatError(problem);
    expect(formatted.title).toBe('Not Found');
    expect(formatted.retryable).toBe(false);
  });

  it('marks 5xx errors as retryable', () => {
    const problem: ProblemDetails = {
      type: 'about:blank',
      title: 'Server Error',
      status: 500,
      detail: 'Internal error',
    };

    const formatted = formatError(problem);
    expect(formatted.retryable).toBe(true);
  });
});
```

## Debugging

All errors include request IDs for traceability:

```typescript
try {
  await api.getCard(cardId);
} catch (error) {
  if (error instanceof ApiError) {
    console.log('Request ID:', error.problem.requestId);
    // Use this ID to trace the request in CloudWatch logs
  }
}
```

In development, errors are logged to the console with full context. In production, they can be sent to error tracking services like Sentry.
