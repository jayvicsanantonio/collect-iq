'use client';

import * as React from 'react';
import Image from 'next/image';
import { type Card } from '@collectiq/shared';
import { cn } from '@/lib/utils';
import { AuthenticityBadge } from './AuthenticityBadge';
import { Button } from '@/components/ui/button';
import {
  Card as UICard,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RefreshCw, Trash2, Share2, ZoomIn, ZoomOut, X } from 'lucide-react';
import { getCardImageAlt } from '@/lib/alt-text';
import {
  BLUR_DATA_URL,
  getCardImageSizes,
  getImageUrlFromS3Key,
} from '@/lib/image-optimization';

export interface CardDetailProps {
  card: Card;
  onReEvaluate?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  isLoading?: {
    reEvaluate?: boolean;
    delete?: boolean;
    share?: boolean;
  };
  className?: string;
}

/**
 * CardDetail component displays comprehensive card information
 * including large zoomable image, metadata, authenticity score, and actions
 */
export function CardDetail({
  card,
  onReEvaluate,
  onDelete,
  onShare,
  isLoading = {},
  className,
}: CardDetailProps) {
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [zoomLevel, setZoomLevel] = React.useState(1);

  // Format currency
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  // Handle zoom in
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  // Handle zoom out
  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  };

  // Reset zoom
  const handleResetZoom = () => {
    setZoomLevel(1);
    setIsZoomed(false);
  };

  // Get image URL from S3 key (using utility function)
  const getImageUrl = getImageUrlFromS3Key;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Image Section */}
      <UICard>
        <CardContent className="p-6">
          <div className="relative">
            {/* Image Container */}
            <div
              className={cn(
                'relative w-full aspect-[2.5/3.5] bg-muted rounded-lg overflow-hidden',
                isZoomed && 'cursor-zoom-out'
              )}
              onClick={() => setIsZoomed(!isZoomed)}
            >
              <Image
                src={getImageUrl(card.frontS3Key)}
                alt={getCardImageAlt(card)}
                fill
                sizes={getCardImageSizes('detail')}
                className={cn(
                  'object-contain transition-transform duration-300',
                  isZoomed && 'cursor-zoom-out'
                )}
                style={{
                  transform: isZoomed ? `scale(${zoomLevel})` : 'scale(1)',
                }}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                quality={90}
                priority
              />
            </div>

            {/* Zoom Controls */}
            {isZoomed && (
              <div className="absolute top-4 right-4 flex gap-2 bg-background/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoomOut();
                  }}
                  disabled={zoomLevel <= 1}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoomIn();
                  }}
                  disabled={zoomLevel >= 3}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetZoom();
                  }}
                  aria-label="Close zoom"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Zoom Hint */}
            {!isZoomed && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-muted-foreground">
                Click to zoom
              </div>
            )}
          </div>
        </CardContent>
      </UICard>

      {/* Metadata Section */}
      <UICard>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-3xl">
                {card.name || 'Unknown Card'}
              </CardTitle>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {card.set && <span>{card.set}</span>}
                {card.number && <span>#{card.number}</span>}
                {card.rarity && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{card.rarity}</span>
                  </>
                )}
              </div>
            </div>

            {/* Authenticity Badge */}
            {card.authenticityScore !== undefined && (
              <AuthenticityBadge
                score={card.authenticityScore}
                breakdown={
                  card.authenticitySignals
                    ? {
                        visualHashConfidence:
                          card.authenticitySignals.visualHashConfidence,
                        textMatchConfidence:
                          card.authenticitySignals.textMatchConfidence,
                        holoPatternConfidence:
                          card.authenticitySignals.holoPatternConfidence,
                      }
                    : undefined
                }
              />
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Condition */}
          {card.conditionEstimate && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Condition
              </div>
              <div className="text-base capitalize">
                {card.conditionEstimate}
              </div>
            </div>
          )}

          {/* Valuation */}
          {(card.valueLow !== undefined ||
            card.valueMedian !== undefined ||
            card.valueHigh !== undefined) && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Current Valuation
              </div>
              <div className="flex items-baseline gap-4">
                {card.valueLow !== undefined && (
                  <div>
                    <div className="text-xs text-muted-foreground">Low</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(card.valueLow)}
                    </div>
                  </div>
                )}
                {card.valueMedian !== undefined && (
                  <div>
                    <div className="text-xs text-muted-foreground">Median</div>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(card.valueMedian)}
                    </div>
                  </div>
                )}
                {card.valueHigh !== undefined && (
                  <div>
                    <div className="text-xs text-muted-foreground">High</div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(card.valueHigh)}
                    </div>
                  </div>
                )}
              </div>
              {card.compsCount !== undefined && (
                <div className="text-xs text-muted-foreground mt-2">
                  Based on {card.compsCount} comparable sales
                </div>
              )}
            </div>
          )}

          {/* Data Sources */}
          {card.sources && card.sources.length > 0 && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Data Sources
              </div>
              <div className="flex flex-wrap gap-2">
                {card.sources.map((source) => (
                  <span
                    key={source}
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="pt-4 border-t border-border space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Added</span>
              <span>{formatDate(card.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span>{formatDate(card.updatedAt)}</span>
            </div>
          </div>
        </CardContent>
      </UICard>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {onReEvaluate && (
          <Button
            onClick={onReEvaluate}
            disabled={isLoading.reEvaluate}
            variant="primary"
            className="flex-1 sm:flex-none"
          >
            {isLoading.reEvaluate ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Re-evaluating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Re-evaluate
              </>
            )}
          </Button>
        )}

        {onShare && (
          <Button
            onClick={onShare}
            disabled={isLoading.share}
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            {isLoading.share ? (
              <>
                <Share2 className="w-4 h-4 animate-pulse" />
                Sharing...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Share
              </>
            )}
          </Button>
        )}

        {onDelete && (
          <Button
            onClick={onDelete}
            disabled={isLoading.delete}
            variant="destructive"
            className="flex-1 sm:flex-none sm:ml-auto"
          >
            {isLoading.delete ? (
              <>
                <Trash2 className="w-4 h-4 animate-pulse" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
