/**
 * ErrorAlert component for displaying user-friendly error messages
 * Supports different severity levels and optional retry/dismiss actions
 */

import * as React from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ============================================================================
// Variants
// ============================================================================

const errorAlertVariants = cva(
  'relative w-full rounded-[var(--radius-md)] border p-4 [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-[var(--foreground)]',
  {
    variants: {
      variant: {
        error:
          'border-red-500/50 bg-red-500/10 text-red-900 dark:text-red-100 [&>svg]:text-red-600 dark:[&>svg]:text-red-400',
        warning:
          'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400',
        info: 'border-blue-500/50 bg-blue-500/10 text-blue-900 dark:text-blue-100 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'error',
    },
  }
);

// ============================================================================
// Types
// ============================================================================

export interface ErrorAlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof errorAlertVariants> {
  title?: string;
  message: string;
  remediation?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  dismissLabel?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ErrorAlert({
  className,
  variant = 'error',
  title,
  message,
  remediation,
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  dismissLabel = 'Dismiss',
  ...props
}: ErrorAlertProps) {
  // Select icon based on variant
  const Icon = React.useMemo(() => {
    switch (variant) {
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
      default:
        return AlertCircle;
    }
  }, [variant]);

  return (
    <div
      role="alert"
      className={cn(errorAlertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />

      <div className="flex-1">
        {title && (
          <h5 className="mb-1 font-semibold leading-none tracking-tight">
            {title}
          </h5>
        )}

        <div className="text-sm [&_p]:leading-relaxed">
          <p>{message}</p>
          {remediation && <p className="mt-2 opacity-90">{remediation}</p>}
        </div>

        {(onRetry || onDismiss) && (
          <div className="mt-4 flex gap-2">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-8"
              >
                {retryLabel}
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-8"
              >
                {dismissLabel}
              </Button>
            )}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
