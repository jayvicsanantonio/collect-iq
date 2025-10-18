'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AuthenticityBadge, ValuationPanel } from '@/components/cards';
import { useValuationRefresh } from '@/hooks/use-valuation-refresh';
import { useToast } from '@/hooks/use-toast';
import type { ValuationData, AuthenticityDetails } from '@collectiq/shared';

// ============================================================================
// Types
// ============================================================================

interface ValuationState {
  status: 'loading' | 'success' | 'error';
  valuation: ValuationData | null;
  authenticity: {
    score: number;
    details: AuthenticityDetails | null;
  } | null;
  cardName: string;
  cardSet: string;
  cardId: string | null;
  error: string | null;
}

type Section = 'authenticity' | 'valuation';

// ============================================================================
// Component
// ============================================================================

function ValuationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const cardId = searchParams.get('cardId');
  const cardName = searchParams.get('name') || 'Unknown Card';
  const cardSet = searchParams.get('set') || 'Unknown Set';
  const authenticityScore = parseFloat(
    searchParams.get('authenticityScore') || '0'
  );

  const [state, setState] = React.useState<ValuationState>({
    status: 'loading',
    valuation: null,
    authenticity: null,
    cardName,
    cardSet,
    cardId,
    error: null,
  });

  const [activeSection, setActiveSection] =
    React.useState<Section>('authenticity');
  const [isSaving, setIsSaving] = React.useState(false);

  // Valuation refresh hook
  const { refresh, isRefreshing } = useValuationRefresh({
    cardId: cardId || '',
    onSuccess: () => {
      // Refetch valuation data after refresh
      fetchValuation();
    },
  });

  // ============================================================================
  // Fetch Data
  // ============================================================================

  const fetchValuation = React.useCallback(async () => {
    if (!cardId) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'No card ID provided',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));

    try {
      // TODO: Replace with actual API call when backend endpoint is ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock valuation data for development
      const mockValuation: ValuationData = {
        low: 45.0,
        median: 67.5,
        high: 95.0,
        trend: {
          direction: 'up',
          percentage: 12.3,
        },
        confidence: 0.85,
        compsCount: 47,
        windowDays: 14,
        sources: [
          { name: 'eBay', logo: '/logos/ebay.svg' },
          { name: 'TCGPlayer', logo: '/logos/tcgplayer.svg' },
          { name: 'PriceCharting', logo: '/logos/pricecharting.svg' },
        ],
        lastUpdated: new Date().toISOString(),
      };

      // Mock authenticity data
      const mockAuthenticity: AuthenticityDetails = {
        visualHashConfidence: 0.89,
        textMatchConfidence: 0.92,
        holoPatternConfidence: 0.85,
        rationale:
          'The card shows strong authenticity signals across all metrics.',
        fakeDetected: false,
      };

      setState({
        status: 'success',
        valuation: mockValuation,
        authenticity: {
          score: authenticityScore || 0.88,
          details: mockAuthenticity,
        },
        cardName,
        cardSet,
        cardId,
        error: null,
      });
    } catch (error) {
      console.error('Valuation fetch error:', error);

      setState((prev) => ({
        ...prev,
        status: 'error',
        error:
          error instanceof Error ? error.message : 'Failed to fetch valuation',
      }));

      toast({
        variant: 'destructive',
        title: 'Valuation failed',
        description: 'Unable to fetch card valuation. Please try again.',
      });
    }
  }, [cardId, cardName, cardSet, authenticityScore, toast]);

  // Fetch on mount
  React.useEffect(() => {
    fetchValuation();
  }, [fetchValuation]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleBack = () => {
    router.push('/authenticity');
  };

  const handleRefresh = async () => {
    if (!cardId) return;
    await refresh(true);
  };

  const handleSaveToVault = async () => {
    if (!cardId) return;

    setIsSaving(true);

    try {
      // TODO: Replace with actual API call when backend endpoint is ready
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: 'Card saved!',
        description: 'Your card has been added to your vault.',
      });

      // Redirect to vault after short delay
      setTimeout(() => {
        router.push('/vault');
      }, 1000);
    } catch (error) {
      console.error('Save error:', error);

      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Unable to save card to vault. Please try again.',
      });

      setIsSaving(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  // Loading State
  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col relative bg-[var(--background)] text-[var(--foreground)]">
        {/* Gradient Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-gradient" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-radials" />
        </div>

        <main className="flex-1 relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="mb-12 text-center">
            <h1
              className="text-5xl sm:text-6xl md:text-7xl font-bold mb-4 font-display tracking-[-0.02em]"
              style={{
                textShadow: 'var(--text-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
              }}
            >
              <span
                className="bg-gradient-to-tr from-[var(--color-holo-cyan)] via-[var(--color-emerald-glow)] to-[var(--color-vault-blue)] bg-clip-text text-transparent"
                style={{
                  textShadow: 'none',
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                }}
              >
                Analyzing Card Value
              </span>
            </h1>
            <p
              className="text-xl sm:text-2xl"
              style={{
                color: 'var(--foreground)',
                opacity: 0.9,
                textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
              }}
            >
              Fetching real-time market data from multiple sources...
            </p>
          </div>

          <Card className="border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--vault-blue)]" />
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Aggregating pricing data from eBay, TCGPlayer, and
                  PriceCharting...
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Error State
  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex flex-col relative bg-[var(--background)] text-[var(--foreground)]">
        {/* Gradient Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-gradient" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-radials" />
        </div>

        <main className="flex-1 relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="mb-8">
            <Button variant="ghost" onClick={handleBack} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <h1
              className="text-5xl sm:text-6xl font-bold mb-4 font-display tracking-[-0.02em]"
              style={{
                textShadow: 'var(--text-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
              }}
            >
              <span
                className="bg-gradient-to-tr from-[var(--color-holo-cyan)] via-[var(--color-emerald-glow)] to-[var(--color-vault-blue)] bg-clip-text text-transparent"
                style={{
                  textShadow: 'none',
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                }}
              >
                Valuation Failed
              </span>
            </h1>
          </div>

          <Card className="border-2 border-[var(--crimson-red)] shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
            <CardHeader>
              <CardTitle>Unable to Fetch Valuation</CardTitle>
              <CardDescription>
                {state.error ||
                  'An error occurred while fetching valuation data.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={fetchValuation} variant="primary">
                  Try Again
                </Button>
                <Button onClick={handleBack} variant="outline">
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Success State
  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--background)] text-[var(--foreground)]">
      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-gradient" />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-radials" />
      </div>

      <main className="flex-1 relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="mb-12">
          <Button variant="ghost" onClick={handleBack} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className="text-5xl sm:text-6xl md:text-7xl font-bold mb-4 font-display tracking-[-0.02em]"
                style={{
                  textShadow:
                    'var(--text-shadow, 0 2px 8px rgba(0, 0, 0, 0.3))',
                }}
              >
                <span
                  className="bg-gradient-to-tr from-[var(--color-holo-cyan)] via-[var(--color-emerald-glow)] to-[var(--color-vault-blue)] bg-clip-text text-transparent"
                  style={{
                    textShadow: 'none',
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
                  }}
                >
                  Analysis Complete
                </span>
              </h1>
              <p
                className="text-xl sm:text-2xl"
                style={{
                  color: 'var(--foreground)',
                  opacity: 0.9,
                  textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
                }}
              >
                {state.cardName} • {state.cardSet}
              </p>
            </div>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="mb-6 flex gap-2 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveSection('authenticity')}
            className={`px-6 py-3 text-base font-semibold transition-colors border-b-2 ${
              activeSection === 'authenticity'
                ? 'border-[var(--vault-blue)] text-[var(--vault-blue)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-foreground'
            }`}
          >
            Authenticity
          </button>
          <button
            onClick={() => setActiveSection('valuation')}
            className={`px-6 py-3 text-base font-semibold transition-colors border-b-2 ${
              activeSection === 'valuation'
                ? 'border-[var(--vault-blue)] text-[var(--vault-blue)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-foreground'
            }`}
          >
            Valuation
          </button>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {/* Authenticity Section */}
          {activeSection === 'authenticity' && state.authenticity && (
            <div className="space-y-6">
              <Card className="border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Authenticity Score</CardTitle>
                      <CardDescription>
                        AI-powered authenticity verification
                      </CardDescription>
                    </div>
                    <AuthenticityBadge
                      score={state.authenticity.score}
                      rationale={state.authenticity.details?.rationale}
                      breakdown={
                        state.authenticity.details
                          ? {
                              visualHashConfidence:
                                state.authenticity.details.visualHashConfidence,
                              textMatchConfidence:
                                state.authenticity.details.textMatchConfidence,
                              holoPatternConfidence:
                                state.authenticity.details
                                  .holoPatternConfidence,
                            }
                          : undefined
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {state.authenticity.details?.rationale}
                  </p>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => setActiveSection('valuation')}
                  variant="primary"
                  size="lg"
                >
                  View Valuation
                </Button>
              </div>
            </div>
          )}

          {/* Valuation Section */}
          {activeSection === 'valuation' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Valuation Panel */}
              <div className="space-y-4">
                <ValuationPanel
                  low={state.valuation?.low || 0}
                  median={state.valuation?.median || 0}
                  high={state.valuation?.high || 0}
                  trend={state.valuation?.trend}
                  confidence={state.valuation?.confidence || 0}
                  compsCount={state.valuation?.compsCount || 0}
                  sources={state.valuation?.sources}
                  lastUpdated={state.valuation?.lastUpdated}
                />

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    variant="outline"
                    className="flex-1"
                  >
                    {isRefreshing ? 'Refreshing...' : 'Refresh Valuation'}
                  </Button>
                  <Button
                    onClick={handleSaveToVault}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? 'Saving...' : 'Save to Vault'}
                  </Button>
                </div>
              </div>

              {/* Right: Summary Card */}
              <div className="space-y-6">
                <Card className="border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardHeader>
                    <CardTitle>Analysis Summary</CardTitle>
                    <CardDescription>
                      Complete card analysis results
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--muted)]/50">
                      <CheckCircle2 className="h-5 w-5 text-[var(--emerald-glow)] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          Authenticity Verified
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                          Score:{' '}
                          {Math.round((state.authenticity?.score || 0) * 100)}%
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--muted)]/50">
                      <CheckCircle2 className="h-5 w-5 text-[var(--emerald-glow)] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          Market Value Estimated
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                          Median:{' '}
                          {state.valuation
                            ? `$${state.valuation.median.toFixed(2)}`
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <p className="text-sm text-[var(--muted-foreground)]">
                        Your card has been analyzed and is ready to be saved to
                        your vault. You can view detailed history and track
                        value changes over time.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                  <CardHeader>
                    <CardTitle>Next Steps</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={handleSaveToVault}
                      disabled={isSaving}
                      className="w-full"
                      size="lg"
                    >
                      {isSaving ? 'Saving...' : 'Save to Vault'}
                    </Button>
                    <Button
                      onClick={() => router.push('/upload')}
                      variant="outline"
                      className="w-full"
                    >
                      Scan Another Card
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ValuationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--holo-cyan)] mx-auto" />
            <p className="text-[var(--muted-foreground)]">Loading...</p>
          </div>
        </div>
      }
    >
      <ValuationPageContent />
    </Suspense>
  );
}
