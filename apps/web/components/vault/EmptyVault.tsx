'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ============================================================================
// Component
// ============================================================================

export function EmptyVault() {
  const router = useRouter();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="text-center">
        {/* Hero Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            {/* Gradient background */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--holo-cyan)] to-[var(--holo-purple)] opacity-20 blur-2xl" />

            {/* Icon container */}
            <div className="relative rounded-full bg-gradient-to-br from-[var(--holo-cyan)] to-[var(--holo-purple)] p-6">
              <Sparkles className="h-12 w-12 text-white" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Headline */}
        <h1 className="mb-3 text-4xl font-bold md:text-5xl font-display">
          Let&apos;s scan your first card
        </h1>

        {/* Description */}
        <p className="mb-8 text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
          Start building your collection with AI-powered valuation and
          authenticity verification
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button
            variant="gradient"
            size="lg"
            onClick={() => router.push('/upload')}
            className="sm:min-w-[200px]"
          >
            <Camera className="mr-2 h-5 w-5" />
            Take Photo
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push('/upload')}
            className="sm:min-w-[200px]"
          >
            <Upload className="mr-2 h-5 w-5" />
            Upload Image
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 sm:grid-cols-3 text-left mt-12">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--vault-blue)]/10">
                <svg
                  className="h-5 w-5 text-[var(--vault-blue)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold">Real-Time Valuation</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Get instant market prices from multiple sources with confidence
                scoring
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--holo-purple)]/10">
                <svg
                  className="h-5 w-5 text-[var(--holo-purple)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold">Authenticity Check</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                AI-powered fake detection using computer vision and pattern
                analysis
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--holo-cyan)]/10">
                <svg
                  className="h-5 w-5 text-[var(--holo-cyan)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold">Secure Storage</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                Your collection is protected with enterprise-grade security
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
