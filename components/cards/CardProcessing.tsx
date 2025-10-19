'use client';

import * as React from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type ProcessingStage =
  | 'extraction'
  | 'authenticity'
  | 'valuation';

export interface ProcessingStatus {
  stage: ProcessingStage;
  completed: ProcessingStage[];
  error?: string;
  estimatedTimeRemaining?: number; // in seconds
}

export interface CardProcessingProps {
  status: ProcessingStatus;
  onRetry?: () => void;
}

// ============================================================================
// Stage Configuration
// ============================================================================

const STAGE_CONFIG: Record<
  ProcessingStage,
  {
    label: string;
    description: string;
    estimatedDuration: number; // in seconds
  }
> = {
  extraction: {
    label: 'Feature Extraction',
    description: 'Analyzing card image and extracting features',
    estimatedDuration: 5,
  },
  authenticity: {
    label: 'Authenticity Analysis',
    description:
      'Verifying card authenticity and detecting counterfeits',
    estimatedDuration: 8,
  },
  valuation: {
    label: 'Market Valuation',
    description:
      'Calculating current market value from multiple sources',
    estimatedDuration: 10,
  },
};

const STAGE_ORDER: ProcessingStage[] = [
  'extraction',
  'authenticity',
  'valuation',
];

// ============================================================================
// Component
// ============================================================================

export function CardProcessing({
  status,
  onRetry,
}: CardProcessingProps) {
  const { stage, completed, error, estimatedTimeRemaining } = status;

  // Calculate progress percentage
  const completedCount = completed.length;
  const totalStages = STAGE_ORDER.length;
  const progressPercentage = Math.round(
    (completedCount / totalStages) * 100
  );

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Analyzing Card</span>
          {estimatedTimeRemaining !== undefined && !error && (
            <span className="text-sm font-normal text-[var(--muted-foreground)]">
              ~{formatTimeRemaining(estimatedTimeRemaining)} remaining
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        {!error && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">
                Progress
              </span>
              <span className="font-medium">
                {progressPercentage}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className="h-full bg-gradient-to-r from-[var(--vault-blue)] to-[var(--holo-cyan)] transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[var(--destructive)] flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-[var(--destructive)]">
                  Analysis Failed
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {error}
                </p>
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="mt-2"
                  >
                    Retry Analysis
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Processing Stages */}
        <div className="space-y-4">
          {STAGE_ORDER.map((stageName) => {
            const stageConfig = STAGE_CONFIG[stageName];
            const isCompleted = completed.includes(stageName);
            const isCurrent = stageName === stage && !error;
            const isPending = !isCompleted && !isCurrent && !error;

            return (
              <div
                key={stageName}
                className={cn(
                  'flex items-start gap-4 rounded-lg border p-4 transition-all',
                  {
                    'border-[var(--vault-blue)] bg-[var(--vault-blue)]/5':
                      isCurrent,
                    'border-[var(--border)] bg-[var(--card)]':
                      !isCurrent,
                    'opacity-50': isPending,
                  }
                )}
              >
                {/* Stage Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {isCompleted && (
                    <CheckCircle2 className="h-5 w-5 text-[var(--emerald-glow)]" />
                  )}
                  {isCurrent && (
                    <Loader2 className="h-5 w-5 text-[var(--vault-blue)] animate-spin" />
                  )}
                  {isPending && (
                    <div className="h-5 w-5 rounded-full border-2 border-[var(--muted)]" />
                  )}
                </div>

                {/* Stage Content */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3
                      className={cn('font-medium', {
                        'text-[var(--vault-blue)]': isCurrent,
                        'text-[var(--foreground)]':
                          isCompleted || isPending,
                      })}
                    >
                      {stageConfig.label}
                    </h3>
                    {isCompleted && (
                      <span className="text-xs text-[var(--emerald-glow)]">
                        Complete
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-xs text-[var(--vault-blue)]">
                        In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {stageConfig.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help Text */}
        {!error && (
          <p className="text-xs text-center text-[var(--muted-foreground)]">
            This process typically takes 20-30 seconds. You can safely
            navigate away and return later.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
