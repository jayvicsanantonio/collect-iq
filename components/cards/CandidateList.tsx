'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Candidate } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export interface CandidateListProps {
  candidates: Candidate[];
  onSelect: (candidate: Candidate) => void;
  selectedId?: string;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function CandidateList({
  candidates,
  onSelect,
  selectedId,
  isLoading = false,
}: CandidateListProps) {
  if (isLoading) {
    return <CandidateListSkeleton />;
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
          isSelected={candidate.id === selectedId}
          onSelect={() => onSelect(candidate)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Candidate Card
// ============================================================================

interface CandidateCardProps {
  candidate: Candidate;
  isSelected: boolean;
  onSelect: () => void;
}

function CandidateCard({
  candidate,
  isSelected,
  onSelect,
}: CandidateCardProps) {
  const confidencePercentage = Math.round(candidate.confidence * 100);
  const confidenceColor = getConfidenceColor(candidate.confidence);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-[var(--vault-blue)]'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={isSelected}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Card Thumbnail */}
          {candidate.imageUrl ? (
            <div className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--muted)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={candidate.imageUrl}
                alt={`${candidate.name} card`}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-20 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]">
              <svg
                className="h-8 w-8 text-[var(--muted-foreground)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}

          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">
                  {candidate.name}
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] truncate">
                  {candidate.set}
                  {candidate.number && ` #${candidate.number}`}
                </p>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  {candidate.rarity}
                </p>
              </div>

              {/* Selection Indicator */}
              {isSelected && (
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--vault-blue)]"
                  aria-label="Selected"
                >
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>

            {/* Confidence Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--muted-foreground)]">
                  Confidence
                </span>
                <span
                  className="font-medium"
                  style={{ color: `var(${confidenceColor})` }}
                >
                  {confidencePercentage}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${confidencePercentage}%`,
                    backgroundColor: `var(${confidenceColor})`,
                  }}
                  role="progressbar"
                  aria-valuenow={confidencePercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${confidencePercentage}% confidence`}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function CandidateListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-20 w-16 flex-shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <div className="mt-3 space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get color variable name based on confidence score
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) {
    return '--emerald-glow';
  } else if (confidence >= 0.5) {
    return '--amber-pulse';
  } else {
    return '--crimson-red';
  }
}
