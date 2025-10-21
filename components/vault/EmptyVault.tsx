'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// Component
// ============================================================================

export function EmptyVault() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col relative bg-[var(--background)] text-[var(--foreground)]">
      {/* Gradient Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-gradient" />
      </div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 landing-radials" />
      </div>

      <main className="flex-1 relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex items-center justify-center min-h-[70vh]">
          <div className="text-center">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--color-holo-cyan)] to-[var(--color-emerald-glow)] opacity-20 blur-2xl" />
                <div className="relative rounded-full bg-gradient-to-br from-[var(--color-holo-cyan)] to-[var(--color-emerald-glow)] p-6">
                  <PackageOpen className="h-12 w-12 text-white" aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* Message */}
            <h1 className="mb-3 text-3xl font-bold md:text-4xl font-display">
              Your Vault is Empty
            </h1>
            <p className="mb-8 text-lg text-[var(--muted-foreground)]">
              Start building your collection by uploading your first card
            </p>

            {/* CTA Button */}
            <Button
              variant="gradient"
              size="lg"
              onClick={() => router.push('/upload')}
              className="min-w-[200px]"
            >
              Upload / Take Photo of Card
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
