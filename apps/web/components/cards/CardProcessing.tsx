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

        {/* Single Unified Progress */}
        {!error && (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            {/* Single Circular Loader with glow effect */}
            <div className="mb-12 relative">
              <div className="absolute inset-0 blur-xl opacity-30 bg-[var(--vault-blue)]" />
              <Loader2 className="h-20 w-20 text-[var(--vault-blue)] animate-spin relative" />
            </div>

            {/* Stage List - Horizontal layout without highlighting */}
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-12 w-full max-w-4xl">
              {STAGE_ORDER.map((stageName, index) => {
                const stageConfig = STAGE_CONFIG[stageName];

                return (
                  <div
                    key={stageName}
                    className="flex-1 text-center p-6 rounded-lg border-2 border-[var(--border)] bg-[var(--card)] transition-all"
                  >
                    <div className="flex flex-col items-center space-y-3">
                      {/* Step number */}
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-[var(--muted)] text-[var(--muted-foreground)]">
                        {index + 1}
                      </div>

                      {/* Stage title */}
                      <p className="font-semibold text-base text-[var(--foreground)]">
                        {stageConfig.label}
                      </p>

                      {/* Stage description */}
                      <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                        {stageConfig.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Help Text */}
            <p className="text-sm text-center text-[var(--muted-foreground)] w-full leading-relaxed px-4">
              This process typically takes 20-30 seconds. You can safely
              navigate away and return later.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
