'use client';

import * as React from 'react';
import Image from 'next/image';
import { type Card as CardType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthenticityBadge } from './AuthenticityBadge';
import { ValuationPanel } from './ValuationPanel';
import { ValuationHistoryChart, type ValuationHistoryDataPoint } from './ValuationHistoryChart';
import { MarketDataTable, type ComparableSale } from './MarketDataTable';
import { FeedbackModal, type FeedbackData } from './FeedbackModal';
import { AlertTriangle, ZoomIn, MessageSquare, RefreshCw, Trash2, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCardImage } from '@/hooks/use-card-image';

export interface CardDetailProps {
  card: CardType;
  onRefreshValuation?: () => void;
  isRefreshing?: boolean;
  onReEvaluate?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
}

/**
 * Visual indicator for a confidence metric
 */
function ConfidenceIndicator({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const percentage = Math.round(value * 100);
  
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--muted-foreground)]">{label}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-all duration-300', color)}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${percentage}%`}
        />
      </div>
    </div>
  );
}

export function CardDetail({ 
  card, 
  onRefreshValuation, 
  isRefreshing,
  onReEvaluate,
  onDelete,
  onShare,
}: CardDetailProps) {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = React.useState(false);
  const { toast } = useToast();
  
  // Use the same image loading hook as VaultCard
  const { imageUrl, isLoading: imageLoading, error: imageError } = useCardImage(card.frontS3Key);

  const hasAuthenticityData = 
    card.authenticityScore !== null && 
    card.authenticityScore !== undefined;

  const signals = card.authenticitySignals;
  const fakeDetected = signals?.fakeDetected;

  /**
   * Handle feedback submission
   * Note: This is a future enhancement - the backend endpoint is not yet implemented
   */
  const handleFeedbackSubmit = React.useCallback(
    async (feedback: FeedbackData) => {
      try {
        // TODO: Implement API call when backend endpoint is available
        // await api.submitFeedback(card.cardId, feedback);
        
        console.log('Feedback submitted:', {
          cardId: card.cardId,
          ...feedback,
        });

        toast({
          title: 'Feedback submitted',
          description: 'Thank you for helping us improve our analysis!',
        });
      } catch (error) {
        console.error('Failed to submit feedback:', error);
        
        toast({
          variant: 'destructive',
          title: 'Submission failed',
          description: 'Failed to submit feedback. Please try again.',
        });
        
        throw error;
      }
    },
    [card.cardId, toast]
  );

  // Mock data for development - valuation history
  // TODO: Replace with actual historical data from API when available
  const valuationHistory: ValuationHistoryDataPoint[] = React.useMemo(() => {
    // Use mock data for Charizard card in development
    if (process.env.NODE_ENV === 'development' && card.name === 'Charizard') {
      return [
        { date: '2025-09-18T00:00:00Z', low: 320, median: 420, high: 550 },
        { date: '2025-09-21T00:00:00Z', low: 325, median: 425, high: 560 },
        { date: '2025-09-24T00:00:00Z', low: 330, median: 430, high: 570 },
        { date: '2025-09-27T00:00:00Z', low: 335, median: 435, high: 575 },
        { date: '2025-09-30T00:00:00Z', low: 340, median: 440, high: 580 },
        { date: '2025-10-03T00:00:00Z', low: 345, median: 445, high: 590 },
        { date: '2025-10-06T00:00:00Z', low: 348, median: 448, high: 595 },
        { date: '2025-10-09T00:00:00Z', low: 350, median: 450, high: 600 },
        { date: '2025-10-12T00:00:00Z', low: 350, median: 450, high: 600 },
        { date: '2025-10-15T00:00:00Z', low: 350, median: 450, high: 600 },
        { date: '2025-10-18T00:00:00Z', low: 350, median: 450, high: 600 },
      ];
    }
    return [];
  }, [card.name]);

  // Mock data for development - comparable sales
  // TODO: Replace with actual comparable sales data from API when available
  const comparableSales: ComparableSale[] = React.useMemo(() => {
    // Use mock data for Charizard card in development
    if (process.env.NODE_ENV === 'development' && card.name === 'Charizard') {
      return [
        { id: 'sale-1', source: 'eBay', date: '2025-10-17T15:30:00Z', price: 475.0, condition: 'Near Mint' },
        { id: 'sale-2', source: 'TCGPlayer', date: '2025-10-16T10:20:00Z', price: 445.0, condition: 'Near Mint' },
        { id: 'sale-3', source: 'eBay', date: '2025-10-15T18:45:00Z', price: 520.0, condition: 'Mint' },
        { id: 'sale-4', source: 'PriceCharting', date: '2025-10-14T12:00:00Z', price: 430.0, condition: 'Near Mint' },
        { id: 'sale-5', source: 'TCGPlayer', date: '2025-10-13T09:15:00Z', price: 460.0, condition: 'Near Mint' },
        { id: 'sale-6', source: 'eBay', date: '2025-10-12T16:30:00Z', price: 395.0, condition: 'Lightly Played' },
        { id: 'sale-7', source: 'eBay', date: '2025-10-11T14:20:00Z', price: 485.0, condition: 'Near Mint' },
        { id: 'sale-8', source: 'TCGPlayer', date: '2025-10-10T11:45:00Z', price: 440.0, condition: 'Near Mint' },
        { id: 'sale-9', source: 'PriceCharting', date: '2025-10-09T08:30:00Z', price: 425.0, condition: 'Near Mint' },
        { id: 'sale-10', source: 'eBay', date: '2025-10-08T19:00:00Z', price: 550.0, condition: 'Mint' },
      ];
    }
    return [];
  }, [card.name]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Card Image Section */}
        <Card className="overflow-hidden border-[6px] border-emerald-400/70 hover:border-cyan-400 transition-all" style={{ boxShadow: '0 6px 25px rgba(16, 185, 129, 0.5)' }}>
          <div className="relative aspect-[2.5/3.5] bg-[var(--muted)]">
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--color-holo-cyan)]" />
              </div>
            )}
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)] text-sm p-4 text-center">
                Failed to load image
              </div>
            )}
            {imageUrl && !imageError && (
              <Dialog>
                <DialogTrigger asChild>
                  <div className="relative group cursor-pointer h-full">
                    <Image
                      src={imageUrl}
                      alt={card.name || 'Card image'}
                      fill
                      className="object-cover transition-transform duration-200 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                      <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl w-full">
                  <div className="relative w-full aspect-[2.5/3.5]">
                    <Image
                      src={imageUrl}
                      alt={card.name || 'Card image'}
                      fill
                      className="object-contain"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </Card>

      {/* Card Details Summary */}
      <Card className="flex flex-col">
        <CardHeader className="pb-4 flex-shrink-0">
          <CardTitle>Card Details</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-4 pb-6">
          {/* Basic Info */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Name</span>
              <span className="font-semibold">{card.name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Set</span>
              <span className="font-medium">{card.set || 'Unknown'}</span>
            </div>
            {card.number && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Number</span>
                <span className="font-medium">#{card.number}</span>
              </div>
            )}
            {card.rarity && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Rarity</span>
                <span className="font-medium">{card.rarity}</span>
              </div>
            )}
            {card.conditionEstimate && (
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Condition</span>
                <span className="font-medium">{card.conditionEstimate}</span>
              </div>
            )}
          </div>

          {/* Authenticity Analysis Summary */}
          {hasAuthenticityData && (
            <div className="pt-2 border-t space-y-1.5">
              <h4 className="text-xs font-semibold text-[var(--foreground)]">Authenticity Analysis</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Score</span>
                <AuthenticityBadge
                  score={card.authenticityScore!}
                  rationale={signals?.rationale}
                  breakdown={
                    signals
                      ? {
                          visualHashConfidence: signals.visualHashConfidence ?? 0,
                          textMatchConfidence: signals.textMatchConfidence ?? 0,
                          holoPatternConfidence: signals.holoPatternConfidence ?? 0,
                        }
                      : undefined
                  }
                />
              </div>
              {fakeDetected && (
                <div className="flex items-center gap-2 text-xs text-[var(--destructive)]">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Potential counterfeit detected</span>
                </div>
              )}
            </div>
          )}

          {/* Market Valuation Summary */}
          {card.valueLow !== null && card.valueMedian !== null && card.valueHigh !== null && (
            <div className="pt-2 border-t space-y-1.5">
              <h4 className="text-xs font-semibold text-[var(--foreground)]">Market Valuation</h4>
              <div className="space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-[var(--muted-foreground)]">Current Value</span>
                  <span className="text-lg font-bold text-[var(--vault-blue)]">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(card.valueMedian)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">Range</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0,
                    }).format(card.valueLow)} - {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                      minimumFractionDigits: 0,
                    }).format(card.valueHigh)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Comparable Sales Summary */}
          {comparableSales.length > 0 && (
            <div className="pt-2 border-t space-y-1.5">
              <h4 className="text-xs font-semibold text-[var(--foreground)]">Comparable Sales</h4>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">Recent Sales</span>
                <span className="font-medium">{comparableSales.length} listings</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">Sources</span>
                <span className="font-medium">
                  {Array.from(new Set(comparableSales.map(s => s.source))).join(', ')}
                </span>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-2 border-t text-xs text-[var(--muted-foreground)] mt-auto">
            <div className="flex justify-between mb-1">
              <span>Added</span>
              <span>{new Date(card.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Updated</span>
              <span>{new Date(card.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authenticity Analysis Section */}
      {hasAuthenticityData && (
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Authenticity Analysis
                {fakeDetected && (
                  <span className="flex items-center gap-1 text-sm font-normal text-[var(--destructive)]">
                    <AlertTriangle className="w-4 h-4" />
                    Potential Fake Detected
                  </span>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFeedbackModalOpen(true)}
                className="gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Report Issue
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Score Badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--muted-foreground)]">
                Overall Authenticity Score
              </span>
              <AuthenticityBadge
                score={card.authenticityScore!}
                rationale={signals?.rationale}
                breakdown={
                  signals
                    ? {
                        visualHashConfidence:
                          signals.visualHashConfidence ?? 0,
                        textMatchConfidence:
                          signals.textMatchConfidence ?? 0,
                        holoPatternConfidence:
                          signals.holoPatternConfidence ?? 0,
                      }
                    : undefined
                }
              />
            </div>

            {/* Detailed Breakdown */}
            {signals && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Detailed Analysis</h4>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  {signals.visualHashConfidence !== null && 
                   signals.visualHashConfidence !== undefined && (
                    <ConfidenceIndicator
                      label="Visual Hash Match"
                      value={signals.visualHashConfidence}
                      color="bg-blue-500"
                    />
                  )}

                  {signals.textMatchConfidence !== null && 
                   signals.textMatchConfidence !== undefined && (
                    <ConfidenceIndicator
                      label="Text Validation"
                      value={signals.textMatchConfidence}
                      color="bg-purple-500"
                    />
                  )}

                  {signals.holoPatternConfidence !== null && 
                   signals.holoPatternConfidence !== undefined && (
                    <ConfidenceIndicator
                      label="Holographic Pattern"
                      value={signals.holoPatternConfidence}
                      color="bg-cyan-500"
                    />
                  )}

                  {signals.borderConsistency !== null && 
                   signals.borderConsistency !== undefined && (
                    <ConfidenceIndicator
                      label="Border Consistency"
                      value={signals.borderConsistency}
                      color="bg-green-500"
                    />
                  )}

                  {signals.fontValidation !== null && 
                   signals.fontValidation !== undefined && (
                    <ConfidenceIndicator
                      label="Font Validation"
                      value={signals.fontValidation}
                      color="bg-amber-500"
                    />
                  )}
                </div>

                {/* Rationale */}
                {signals.rationale && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-semibold mb-2">Analysis Notes</h4>
                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                      {signals.rationale}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

        {/* Valuation Section */}
        <div className="lg:col-span-2">
          <ValuationPanel
            card={card}
            onRefresh={onRefreshValuation}
            isRefreshing={isRefreshing}
          />
        </div>
      </div>

      {/* Valuation History Chart - Future Enhancement */}
      {valuationHistory.length > 0 && (
        <ValuationHistoryChart data={valuationHistory} />
      )}

      {/* Market Data Sources Table - Future Enhancement */}
      {comparableSales.length > 0 && (
        <MarketDataTable data={comparableSales} />
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        onSubmit={handleFeedbackSubmit}
        cardId={card.cardId}
      />
    </div>
  );
}
