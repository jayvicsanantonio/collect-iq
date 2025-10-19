/**
 * Example: Integrating the error handling system into a component
 * This file demonstrates best practices for error handling in CollectIQ
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

'use client';

import * as React from 'react';
import { api, ApiError } from '@/lib/api';
import { useErrorHandler } from '@/hooks/use-error-handler';
import {
  success,
  error as errorToast,
  promise,
} from '@/hooks/use-toast';
import { ErrorAlert } from '@/components/ui/error-alert';
import {
  NotFoundError,
  ServerError,
  ForbiddenError,
} from '@/components/ui/error-states';
import { formatError } from '@/lib/errors';
import type { ProblemDetails } from '@/lib/types';

// ============================================================================
// Example 1: Simple Component with Toast Notifications
// ============================================================================

export function SimpleErrorHandlingExample() {
  const { handleError } = useErrorHandler();

  async function saveCard() {
    try {
      const _card = await api.createCard({
        frontS3Key: 'uploads/user/card.jpg',
        name: 'Charizard',
        set: 'Base Set',
      });

      success('Card saved to vault!');
      return _card;
    } catch (err) {
      if (err instanceof ApiError) {
        // Automatically shows toast and handles auth redirect
        handleError(err.problem);
      }
    }
  }

  return <button onClick={saveCard}>Save Card</button>;
}

// ============================================================================
// Example 2: Component with Inline Error Display
// ============================================================================

export function InlineErrorExample() {
  const [error, setError] = React.useState<ProblemDetails | null>(
    null
  );
  const [_loading, setLoading] = React.useState(false);
  const [currentFile, setCurrentFile] = React.useState<File | null>(
    null
  );

  async function uploadFile(file: File) {
    setCurrentFile(file);
    setLoading(true);
    setError(null);

    try {
      const _presign = await api.getPresignedUrl({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });

      // Upload to S3...
      success('File uploaded successfully!');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problem);
      }
    } finally {
      setLoading(false);
    }
  }

  // Display inline error
  if (error) {
    const formatted = formatError(error);
    return (
      <ErrorAlert
        variant="error"
        title={formatted.title}
        message={formatted.message}
        remediation={formatted.remediation}
        onRetry={
          formatted.retryable && currentFile
            ? () => uploadFile(currentFile)
            : undefined
        }
        onDismiss={() => setError(null)}
      />
    );
  }

  return <div>{/* Upload UI */}</div>;
}

// ============================================================================
// Example 3: Full-Page Error States
// ============================================================================

export function FullPageErrorExample({ cardId }: { cardId: string }) {
  const [error, setError] = React.useState<ProblemDetails | null>(
    null
  );
  const [_card, setCard] = React.useState(null);
  const [_loading, setLoading] = React.useState(true);

  async function loadCard() {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getCard(cardId);
      setCard(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.problem);
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  // Handle specific error states
  if (error?.status === 404) {
    return <NotFoundError resourceType="card" />;
  }

  if (error?.status === 403) {
    return <ForbiddenError />;
  }

  if (error && error.status >= 500) {
    return <ServerError onRetry={loadCard} />;
  }

  if (_loading) {
    return <div>Loading...</div>;
  }

  return <div>{/* Card display */}</div>;
}

// ============================================================================
// Example 4: Promise-based Toast
// ============================================================================

export function PromiseToastExample() {
  async function deleteCard(cardId: string) {
    // Toast automatically updates based on promise state
    await promise(api.deleteCard(cardId), {
      loading: 'Deleting card...',
      success: 'Card deleted successfully!',
      error: 'Failed to delete card',
    });
  }

  return (
    <button onClick={() => deleteCard('card-123')}>
      Delete Card
    </button>
  );
}

// ============================================================================
// Example 5: Custom Error Handling
// ============================================================================

export function CustomErrorHandlingExample() {
  const { handleError } = useErrorHandler({
    showToast: false, // Don't show automatic toast
    redirectOnAuth: true,
    onError: (problem) => {
      // Custom error handling logic
      console.log('Custom error handler:', problem);

      // Show custom error UI based on error type
      if (problem.status === 413) {
        errorToast('Please upload a smaller file (max 12 MB)');
      } else if (problem.status === 415) {
        errorToast('Please use JPG, PNG, or HEIC format');
      } else {
        // Default error handling
        const formatted = formatError(problem);
        errorToast(formatted.message, formatted.title);
      }
    },
  });

  async function _uploadFile(file: File) {
    try {
      const _presign = await api.getPresignedUrl({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      // Upload...
    } catch (err) {
      if (err instanceof ApiError) {
        handleError(err.problem);
      }
    }
  }

  return <div>{/* Upload UI */}</div>;
}

// ============================================================================
// Example 6: Error Handling with SWR
// ============================================================================

import useSWR from 'swr';

export function SWRErrorHandlingExample({
  cardId,
}: {
  cardId: string;
}) {
  const { data, error, mutate } = useSWR(`/cards/${cardId}`, () =>
    api.getCard(cardId)
  );

  // Handle error states
  if (error instanceof ApiError) {
    if (error.problem.status === 404) {
      return <NotFoundError resourceType="card" />;
    }

    if (error.problem.status >= 500) {
      return <ServerError onRetry={() => mutate()} />;
    }

    const formatted = formatError(error.problem);
    return (
      <ErrorAlert
        variant="error"
        title={formatted.title}
        message={formatted.message}
        remediation={formatted.remediation}
        onRetry={formatted.retryable ? () => mutate() : undefined}
      />
    );
  }

  if (!data) {
    return <div>Loading...</div>;
  }

  return <div>{/* Card display */}</div>;
}

// ============================================================================
// Example 7: Multiple Error States
// ============================================================================

export function MultipleErrorStatesExample() {
  const [uploadError, setUploadError] =
    React.useState<ProblemDetails | null>(null);
  const [saveError, setSaveError] =
    React.useState<ProblemDetails | null>(null);

  async function _handleUploadAndSave(file: File) {
    // Clear previous errors
    setUploadError(null);
    setSaveError(null);

    try {
      // Step 1: Upload
      const _presign = await api.getPresignedUrl({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      // Upload to S3...

      // Step 2: Save card
      try {
        await api.createCard({
          frontS3Key: _presign.key,
        });
        success('Card saved successfully!');
      } catch (err) {
        if (err instanceof ApiError) {
          setSaveError(err.problem);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setUploadError(err.problem);
      }
    }
  }

  return (
    <div>
      {/* Show upload error */}
      {uploadError && (
        <ErrorAlert
          variant="error"
          {...formatError(uploadError)}
          onDismiss={() => setUploadError(null)}
        />
      )}

      {/* Show save error */}
      {saveError && (
        <ErrorAlert
          variant="error"
          {...formatError(saveError)}
          onDismiss={() => setSaveError(null)}
        />
      )}

      {/* Upload UI */}
    </div>
  );
}
