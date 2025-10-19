'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

/**
 * Root page that redirects based on authentication status
 * - Authenticated users -> /upload
 * - Unauthenticated users -> stays on landing page (handled by (public) route)
 */
export default function HomePage() {
  const router = useRouter();

  async function checkAuthAndRedirect() {
    try {
      const authenticated = await isAuthenticated();
      if (authenticated) {
        // Redirect authenticated users to upload page
        router.replace('/upload');
      } else {
        // Redirect unauthenticated users to public landing page
        router.replace('/landing');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // On error, redirect to landing page
      router.replace('/landing');
    }
  }

  useEffect(() => {
    checkAuthAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show loading state while checking auth
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--holo-cyan)] mx-auto" />
        <p className="text-[var(--muted-foreground)]">Loading...</p>
      </div>
    </div>
  );
}
