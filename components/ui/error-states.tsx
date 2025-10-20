/**
 * Common error state components for specific HTTP errors
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, FileQuestion, Lock, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Base Error State Component
// ============================================================================

interface ErrorStateProps {
  icon?: React.ReactNode;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

function ErrorState({
  icon,
  title,
  message,
  action,
  secondaryAction,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[400px] flex-col items-center justify-center p-8 text-center',
        className
      )}
    >
      {icon && <div className="mb-4">{icon}</div>}
      <h2 className="mb-2 text-xl font-semibold">{title}</h2>
      <p className="mb-6 max-w-md text-sm text-[var(--muted-foreground)]">
        {message}
      </p>
      {(action || secondaryAction) && (
        <div className="flex gap-2">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 401 Unauthorized - Redirect to Auth
// ============================================================================

export function UnauthorizedError() {
  React.useEffect(() => {
    // Redirect to auth after a short delay
    const timeout = setTimeout(() => {
      window.location.href = '/api/auth/signin';
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <ErrorState
      icon={<Lock className="h-12 w-12 text-amber-500" />}
      title="Session Expired"
      message="Your session has expired. You will be redirected to sign in."
      action={{
        label: 'Sign In Now',
        onClick: () => {
          window.location.href = '/api/auth/signin';
        },
      }}
    />
  );
}

// ============================================================================
// 403 Forbidden
// ============================================================================

export function ForbiddenError() {
  const router = useRouter();

  return (
    <ErrorState
      icon={<Lock className="h-12 w-12 text-red-500" />}
      title="Access Denied"
      message="You don't have permission to access this resource. Please contact support if you believe this is an error."
      action={{
        label: 'Go to Vault',
        onClick: () => router.push('/vault'),
      }}
      secondaryAction={{
        label: 'Go Home',
        onClick: () => router.push('/'),
      }}
    />
  );
}

// ============================================================================
// 404 Not Found
// ============================================================================

export function NotFoundError({
  resourceType = 'resource',
}: {
  resourceType?: string;
}) {
  const router = useRouter();

  return (
    <ErrorState
      icon={<FileQuestion className="h-12 w-12 text-blue-500" />}
      title="Not Found"
      message={`The ${resourceType} you're looking for doesn't exist or has been removed.`}
      action={{
        label: 'Go to Vault',
        onClick: () => router.push('/vault'),
      }}
      secondaryAction={{
        label: 'Go Back',
        onClick: () => router.back(),
      }}
    />
  );
}

// ============================================================================
// 413 Payload Too Large
// ============================================================================

export function PayloadTooLargeError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      icon={<AlertCircle className="h-12 w-12 text-amber-500" />}
      title="File Too Large"
      message="The image you selected is too large. Please upload a file under 12 MB."
      action={
        onRetry
          ? {
              label: 'Try Another File',
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}

// ============================================================================
// 415 Unsupported Media Type
// ============================================================================

export function UnsupportedMediaError({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorState
      icon={<AlertCircle className="h-12 w-12 text-amber-500" />}
      title="Unsupported File Type"
      message="The file type you selected is not supported. Please use JPG, PNG, or HEIC format."
      action={
        onRetry
          ? {
              label: 'Try Another File',
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}

// ============================================================================
// 429 Rate Limit with Countdown
// ============================================================================

interface RateLimitErrorProps {
  retryAfter?: number; // seconds
  onRetry?: () => void;
}

export function RateLimitError({
  retryAfter = 60,
  onRetry,
}: RateLimitErrorProps) {
  const [countdown, setCountdown] = React.useState(retryAfter);

  React.useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <ErrorState
      icon={<Timer className="h-12 w-12 text-amber-500" />}
      title="Rate Limit Exceeded"
      message={`You've made too many requests. Please wait ${countdown > 0 ? formatTime(countdown) : 'a moment'} before trying again.`}
      action={
        countdown === 0 && onRetry
          ? {
              label: 'Try Again',
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}

// ============================================================================
// 5xx Server Error with Retry
// ============================================================================

interface ServerErrorProps {
  onRetry?: () => void;
  message?: string;
}

export function ServerError({
  onRetry,
  message = 'Something went wrong on our end. Please try again in a moment.',
}: ServerErrorProps) {
  return (
    <ErrorState
      icon={<AlertCircle className="h-12 w-12 text-red-500" />}
      title="Server Error"
      message={message}
      action={
        onRetry
          ? {
              label: 'Try Again',
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}
