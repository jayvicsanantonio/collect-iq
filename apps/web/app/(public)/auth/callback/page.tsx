'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

/**
 * OAuth callback handler
 * Amplify automatically handles the OAuth code exchange
 * This page just checks auth status and redirects appropriately
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    // Give Amplify a moment to process the OAuth callback
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        // Redirect to upload page on successful authentication
        router.replace('/upload');
      } else {
        // If not authenticated, redirect to landing page
        router.replace('/landing');
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      // On error, redirect to landing page
      router.replace('/landing');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--holo-cyan)] mx-auto" />
        <h2 className="text-xl font-semibold mb-2">Completing sign in...</h2>
        <p className="text-[var(--muted-foreground)]">
          Please wait while we verify your credentials
        </p>
      </div>
    </div>
  );
}
