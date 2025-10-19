'use client';

import * as React from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface UploadProgressProps {
  file: File;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function UploadProgress({
  file,
  progress,
  status,
  error,
  onCancel,
  onRetry,
  className,
}: UploadProgressProps) {
  const [thumbnailUrl, setThumbnailUrl] = React.useState<
    string | null
  >(null);

  // ============================================================================
  // Thumbnail Generation
  // ============================================================================

  React.useEffect(() => {
    // Create object URL for thumbnail preview
    const url = URL.createObjectURL(file);
    setThumbnailUrl(url);

    // Cleanup on unmount
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // ============================================================================
  // Progress Calculation
  // ============================================================================

  const progressPercent = Math.min(Math.max(progress, 0), 100);
  const isComplete = status === 'success';
  const hasError = status === 'error';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      className={cn(
        'relative flex items-center gap-4 rounded-xl border p-4 transition-all',
        hasError
          ? 'border-[var(--destructive)] bg-[var(--destructive)]/5'
          : 'border-[var(--border)] bg-[var(--card)]',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--muted)]">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={file.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-8 w-8 animate-pulse rounded bg-[var(--muted-foreground)]/20" />
          </div>
        )}

        {/* Status overlay */}
        {isComplete && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/80">
            <CheckCircle2
              className="h-6 w-6 text-white"
              aria-hidden="true"
            />
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--destructive)]/80">
            <AlertCircle
              className="h-6 w-6 text-white"
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* File name */}
        <p className="truncate text-sm font-medium text-[var(--foreground)]">
          {file.name}
        </p>

        {/* File size */}
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          {formatFileSize(file.size)}
        </p>

        {/* Progress bar or status */}
        {(status === 'idle' || status === 'uploading') && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[var(--muted-foreground)]">
                {status === 'idle' ? 'Preparing...' : 'Uploading...'}
              </span>
              <span className="font-medium text-[var(--foreground)]">
                {progressPercent}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full bg-gradient-to-r from-[var(--holo-cyan)] to-[var(--holo-purple)] transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-500">
            <CheckCircle2
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
            <span>Upload complete</span>
          </div>
        )}

        {status === 'error' && error && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--destructive)]">
            <AlertCircle
              className="h-3.5 w-3.5 flex-shrink-0"
              aria-hidden="true"
            />
            <span className="line-clamp-2">{error}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {status === 'uploading' && onCancel && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Cancel upload"
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {status === 'error' && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-xs"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${
    sizes[i]
  }`;
}
