'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  AlertTriangle,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AuthenticityBadge, FeedbackModal } from '@/components/cards';
import { useToast } from '@/hooks/use-toast';
import type { AuthenticityDetails } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

interface AuthenticityState {
  status: 'loading' | 'success' | 'error';
  score: number;
  details: AuthenticityDetails | null;
  cardName: string;
  cardSet: string;
  imageUrl: string;
  error: string | null;
}

// ============================================================================
// Component
// ============================================================================

export default function AuthenticityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const cardId = searchParams.get('cardId');
  const cardName = searchParams.get('name') || 'Unknown Card';
  const cardSet = searchParams.get('set') || 'Unknown Set';
  const s3Key = searchParams.get('key');

  const [state, setState] = React.useState<AuthenticityState>({
    status: 'loading',
    score: 0,
    details: null,
    cardName,
    cardSet,
    imageUrl: '',
    error: null,
  });

  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] =
    React.useState(false);

  // ============================================================================
  // Fetch Authenticity Analysis
  // ============================================================================

  const fetchAuthenticity = React.useCallback(async () => {
    if (!s3Key && !cardId) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: 'No card information provided',
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

      // Mock authenticity data for development
      const mockDetails: AuthenticityDetails = {
        visualHashConfidence: 0.89,
        textMatchConfidence: 0.92,
        holoPatternConfidence: 0.85,
        rationale:
          'The card shows strong authenticity signals across all metrics. Visual hash matches known authentic examples with high confidence. Text rendering and font characteristics are consistent with genuine cards. Holographic pattern analysis shows expected rainbow effect and light refraction patterns.',
        fakeDetected: false,
      };

      const mockScore = 0.88;

      setState({
        status: 'success',
        score: mockScore,
        details: mockDetails,
        cardName,
        cardSet,
        imageUrl: 'https://images.pokemontcg.io/base1/4_hires.png',
        error: null,
      });
    } catch (error) {
      console.error('Authenticity analysis error:', error);

      setState((prev) => ({
        ...prev,
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze authenticity',
      }));

      toast({
        variant: 'destructive',
        title: 'Analysis failed',
        description:
          'Unable to analyze card authenticity. Please try again.',
      });
    }
  }, [s3Key, cardId, cardName, cardSet, toast]);

  // Fetch on mount
  React.useEffect(() => {
    fetchAuthenticity();
  }, [fetchAuthenticity]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleBack = () => {
    router.push('/identify');
  };

  const handleContinue = () => {
    // Navigate to valuation screen with card details
    const params = new URLSearchParams({
      cardId: cardId || '',
      name: state.cardName,
      set: state.cardSet,
      authenticityScore: state.score.toString(),
    });
    const url = `/valuation?${params.toString()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(url as any);
  };

  const handleOpenFeedback = () => {
    setIsFeedbackModalOpen(true);
  };

  const handleCloseFeedback = () => {
    setIsFeedbackModalOpen(false);
  };

  const handleSubmitFeedback = async (feedback: {
    reason: string;
    details: string;
  }) => {
    // TODO: Replace with actual API call when backend endpoint is ready
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('Feedback submitted:', {
      cardId,
      ...feedback,
      timestamp: new Date().toISOString(),
    });

    toast({
      title: 'Feedback submitted',
      description: 'Thank you for helping us improve!',
    });
  };

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
                  Analyzing Authenticity
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
                Running AI-powered authenticity checks...
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
                    Analyzing visual hash, text patterns, and holographic
                    signals...
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
                Back
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
                  Analysis Failed
                </span>
              </h1>
            </div>

            <Card
              className="border-2 border-[var(--crimson-red)] shadow-lg"
              style={{ backgroundColor: 'var(--background)' }}
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-[var(--crimson-red)] mt-0.5" />
                  <div>
                    <CardTitle>Unable to Analyze Authenticity</CardTitle>
                    <CardDescription className="mt-2">
                      {state.error || 'An error occurred during analysis.'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={fetchAuthenticity} variant="primary">
                    <RotateCw className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                  <Button onClick={handleBack} variant="outline">
                    Go Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Success State
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
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <Button variant="ghost" onClick={handleBack} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Identification
            </Button>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1
                  className="mb-2 text-4xl sm:text-5xl font-bold font-display tracking-[-0.02em]"
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
                    Authenticity Analysis
                  </span>
                </h1>
                <p
                  className="text-lg"
                  style={{
                    color: 'var(--foreground)',
                    opacity: 0.9,
                  }}
                >
                  {state.cardName} • {state.cardSet}
                </p>
              </div>
          <AuthenticityBadge
            score={state.score}
            rationale={state.details?.rationale}
            breakdown={
              state.details
                ? {
                    visualHashConfidence:
                      state.details.visualHashConfidence,
                    textMatchConfidence:
                      state.details.textMatchConfidence,
                    holoPatternConfidence:
                      state.details.holoPatternConfidence,
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* Warning for Low Scores */}
      {state.details?.fakeDetected && (
        <Card className="mb-6 border-[var(--crimson-red)] bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[var(--crimson-red)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-[var(--crimson-red)]">
                  Potential Counterfeit Detected
                </p>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  This card shows characteristics that may indicate it
                  is not authentic. Please review the detailed
                  analysis below and consider having the card
                  professionally authenticated.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Split View Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Card Image with Zoom */}
        <Card>
          <CardHeader>
            <CardTitle>Card Image</CardTitle>
            <CardDescription>
              Use the controls below to zoom and rotate the image
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Image Container */}
              <div className="relative bg-[var(--muted)] rounded-lg overflow-hidden aspect-[2.5/3.5] flex items-center justify-center">
                {state.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={state.imageUrl}
                    alt={`${state.cardName} from ${state.cardSet}`}
                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    }}
                  />
                ) : (
                  <div className="text-[var(--muted-foreground)]">
                    No image available
                  </div>
                )}
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.5}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-[var(--muted-foreground)] min-w-[4rem] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-[var(--border)] mx-2" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRotate}
                  aria-label="Rotate image"
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Authenticity Metrics */}
        <div className="space-y-6">
          {/* Visual Fingerprint */}
          <Card>
            <CardHeader>
              <CardTitle>Visual Fingerprint Analysis</CardTitle>
              <CardDescription>
                Perceptual hash comparison with known authentic cards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Match Confidence
                  </span>
                  <span className="text-2xl font-bold">
                    {Math.round(
                      (state.details?.visualHashConfidence || 0) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-[var(--muted)] rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-500"
                    style={{
                      width: `${
                        (state.details?.visualHashConfidence || 0) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Visual hash analysis compares the card&apos;s unique
                  visual signature against our database of authentic
                  cards.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Text Validation */}
          <Card>
            <CardHeader>
              <CardTitle>Text Validation</CardTitle>
              <CardDescription>
                Font, kerning, and text rendering analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Text Match Score
                  </span>
                  <span className="text-2xl font-bold">
                    {Math.round(
                      (state.details?.textMatchConfidence || 0) * 100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-[var(--muted)] rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{
                      width: `${
                        (state.details?.textMatchConfidence || 0) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Analyzes font characteristics, kerning, and text
                  rendering quality to detect printing
                  inconsistencies.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Holographic Pattern */}
          <Card>
            <CardHeader>
              <CardTitle>Holographic Signal Analysis</CardTitle>
              <CardDescription>
                Rainbow effect and light refraction patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Pattern Confidence
                  </span>
                  <span className="text-2xl font-bold">
                    {Math.round(
                      (state.details?.holoPatternConfidence || 0) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-[var(--muted)] rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-500"
                    style={{
                      width: `${
                        (state.details?.holoPatternConfidence || 0) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Examines holographic foil patterns and light
                  refraction to verify authentic holographic printing.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Rationale */}
          {state.details?.rationale && (
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis Summary</CardTitle>
                <CardDescription>
                  Detailed explanation from our AI system
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">
                  {state.details.rationale}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-between">
        <Button
          onClick={handleOpenFeedback}
          variant="outline"
          size="lg"
          className="sm:w-auto"
        >
          <Flag className="mr-2 h-4 w-4" />
          Report Incorrect Result
        </Button>
        <Button onClick={handleContinue} variant="primary" size="lg">
          Continue to Valuation
        </Button>
      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={handleCloseFeedback}
        onSubmit={handleSubmitFeedback}
        cardId={cardId || ''}
      />
        </div>
      </main>
    </div>
  );
}
