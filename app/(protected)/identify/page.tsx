'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CandidateList } from '@/components/cards';
import { useToast } from '@/hooks/use-toast';
import type { Candidate } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

type IdentificationStatus =
  | 'loading'
  | 'success'
  | 'low-confidence'
  | 'no-results'
  | 'error';

interface IdentificationState {
  status: IdentificationStatus;
  candidates: Candidate[];
  error: string | null;
  selectedCandidate: Candidate | null;
}

// ============================================================================
// Component
// ============================================================================

export default function IdentifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const s3Key = searchParams.get('key');

  const [state, setState] = React.useState<IdentificationState>({
    status: 'loading',
    candidates: [],
    error: null,
    selectedCandidate: null,
  });

  // ============================================================================
  // Fetch Identification Results
  // ============================================================================

  const fetchIdentification = React.useCallback(async () => {
    if (!s3Key) {
      setState({
        status: 'error',
        candidates: [],
        error: 'No image key provided',
        selectedCandidate: null,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      status: 'loading',
      error: null,
    }));

    try {
      // TODO: Replace with actual API call when backend endpoint is ready
      // For now, simulate API call with mock data
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock candidates for development
      const mockCandidates: Candidate[] = [
        {
          id: '1',
          name: 'Charizard',
          set: 'Base Set',
          number: '4',
          rarity: 'Holo Rare',
          confidence: 0.92,
          imageUrl: 'https://images.pokemontcg.io/base1/4_hires.png',
        },
        {
          id: '2',
          name: 'Charizard',
          set: 'Base Set 2',
          number: '4',
          rarity: 'Holo Rare',
          confidence: 0.78,
          imageUrl: 'https://images.pokemontcg.io/base2/4_hires.png',
        },
        {
          id: '3',
          name: 'Charizard',
          set: 'Legendary Collection',
          number: '3',
          rarity: 'Holo Rare',
          confidence: 0.65,
          imageUrl: 'https://images.pokemontcg.io/base5/3_hires.png',
        },
      ];

      // Determine status based on confidence
      const topConfidence = mockCandidates[0]?.confidence || 0;
      let status: IdentificationStatus = 'success';

      if (mockCandidates.length === 0) {
        status = 'no-results';
      } else if (topConfidence < 0.7) {
        status = 'low-confidence';
      }

      setState({
        status,
        candidates: mockCandidates,
        error: null,
        selectedCandidate: null,
      });
    } catch (error) {
      console.error('Identification error:', error);

      setState({
        status: 'error',
        candidates: [],
        error:
          error instanceof Error ? error.message : 'Failed to identify card',
        selectedCandidate: null,
      });

      toast({
        variant: 'destructive',
        title: 'Identification failed',
        description: 'Unable to identify the card. Please try again.',
      });
    }
  }, [s3Key, toast]);

  // Fetch on mount
  React.useEffect(() => {
    fetchIdentification();
  }, [fetchIdentification]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleSelectCandidate = React.useCallback((candidate: Candidate) => {
    setState((prev) => ({
      ...prev,
      selectedCandidate: candidate,
    }));
  }, []);

  const handleConfirmSelection = React.useCallback(() => {
    if (!state.selectedCandidate) {
      toast({
        variant: 'destructive',
        title: 'No selection',
        description: 'Please select a card to continue.',
      });
      return;
    }

    toast({
      title: 'Card selected',
      description: `Selected ${state.selectedCandidate.name}`,
    });

    // Navigate to authenticity analysis with card details
    const params = new URLSearchParams({
      name: state.selectedCandidate.name,
      set: state.selectedCandidate.set,
      ...(s3Key && { key: s3Key }),
      ...(state.selectedCandidate.id && { cardId: state.selectedCandidate.id }),
    });
    const url = `/authenticity?${params.toString()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(url as any);
  }, [state.selectedCandidate, s3Key, router, toast]);

  const handleManualEntry = React.useCallback(() => {
    // TODO: Implement manual entry form
    toast({
      title: 'Manual entry',
      description: 'Manual entry feature coming soon.',
    });
  }, [toast]);

  const handleRetry = React.useCallback(() => {
    fetchIdentification();
  }, [fetchIdentification]);

  const handleBack = React.useCallback(() => {
    router.push('/upload');
  }, [router]);

  // ============================================================================
  // Render
  // ============================================================================

  // Loading State
  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col relative bg-[var(--background)]">
        {/* Gradient Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-gradient" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-radials" />
        </div>

        <main className="flex-1 relative z-10 flex items-start justify-center px-6 pt-20 pb-12">
          <div className="max-w-4xl w-full">
            <div className="mb-12 text-center">
              <h1
                className="mb-4 text-5xl sm:text-6xl md:text-7xl font-bold font-display tracking-[-0.02em]"
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
                  Identifying Card
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
                Analyzing your card with AI...
              </p>
            </div>

            <Card
              className="border-2 border-gray-200 dark:border-white/10 shadow-lg"
              style={{ backgroundColor: 'var(--background)' }}
            >
              <CardContent className="p-12">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="relative">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-[var(--muted)] border-t-[var(--color-holo-cyan)]" />
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    This may take a few moments...
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Error State
  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex flex-col relative bg-[var(--background)]">
        {/* Gradient Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-gradient" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-radials" />
        </div>

        <main className="flex-1 relative z-10 flex items-start justify-center px-6 pt-20 pb-12">
          <div className="max-w-4xl w-full">
            <div className="mb-8">
              <Button variant="ghost" onClick={handleBack} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Upload
              </Button>
              <h1
                className="mb-4 text-5xl sm:text-6xl font-bold font-display tracking-[-0.02em]"
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
                  Identification Failed
                </span>
              </h1>
            </div>

            <Card
              className="border-2 border-[var(--crimson-red)] shadow-lg"
              style={{ backgroundColor: 'var(--background)' }}
            >
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[var(--crimson-red)] mt-0.5" />
              <div>
                <CardTitle>Unable to Identify Card</CardTitle>
                <CardDescription className="mt-2">
                  {state.error ||
                    'An error occurred while processing your image.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleRetry} variant="primary">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button onClick={handleBack} variant="outline">
                Upload Different Image
              </Button>
              <Button onClick={handleManualEntry} variant="ghost">
                Enter Manually
              </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </main>
      </div>
    );
  }

  // No Results State
  if (state.status === 'no-results') {
    return (
      <div className="min-h-screen flex flex-col relative bg-[var(--background)]">
        {/* Gradient Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-gradient" />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 landing-radials" />
        </div>

        <main className="flex-1 relative z-10 flex items-start justify-center px-6 pt-20 pb-12">
          <div className="max-w-4xl w-full">
            <div className="mb-8">
              <Button variant="ghost" onClick={handleBack} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Upload
              </Button>
              <h1
                className="mb-4 text-5xl sm:text-6xl font-bold font-display tracking-[-0.02em]"
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
                  No Matches Found
                </span>
              </h1>
            </div>

            <Card
              className="border-2 border-gray-200 dark:border-white/10 shadow-lg"
              style={{ backgroundColor: 'var(--background)' }}
            >
          <CardHeader>
            <CardTitle>We couldn&apos;t find any matching cards</CardTitle>
            <CardDescription>
              The image might be unclear or the card might not be in our
              database yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleRetry} variant="primary">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button onClick={handleBack} variant="outline">
                Upload Different Image
              </Button>
              <Button onClick={handleManualEntry} variant="ghost">
                Enter Manually
              </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        </main>
      </div>
    );
  }

  // Success State (with candidates)
  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--background)]">
      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-gradient" />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-radials" />
      </div>

      <main className="flex-1 relative z-10 px-6 pt-8 pb-12">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <Button variant="ghost" onClick={handleBack} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Upload
            </Button>
            <h1
              className="mb-4 text-5xl sm:text-6xl font-bold font-display tracking-[-0.02em]"
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
                Select Your Card
              </span>
            </h1>
            <p
              className="text-lg sm:text-xl"
              style={{
                color: 'var(--foreground)',
                opacity: 0.9,
              }}
            >
              {state.status === 'low-confidence'
                ? 'We found some possible matches. Please confirm which card this is.'
                : 'We found the following matches. Select the correct one to continue.'}
            </p>
          </div>

      {/* Low Confidence Warning */}
      {state.status === 'low-confidence' && (
        <Card className="mb-6 border-[var(--amber-pulse)]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[var(--amber-pulse)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Low Confidence Match</p>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  The identification confidence is lower than usual. Please
                  verify the selection carefully or try uploading a clearer
                  image.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Candidate List */}
      <div className="mb-6">
        <CandidateList
          candidates={state.candidates}
          onSelect={handleSelectCandidate}
          selectedId={state.selectedCandidate?.id}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleConfirmSelection}
            variant="primary"
            size="lg"
            disabled={!state.selectedCandidate}
          >
            Continue with Selection
          </Button>
          <Button onClick={handleManualEntry} variant="outline" size="lg">
            Enter Manually
          </Button>
        </div>
        <Button onClick={handleRetry} variant="ghost" size="lg">
          <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
        </div>
      </main>
    </div>
  );
}
