'use client';

import { useEffect, useState } from 'react';
import { isAuthenticated } from '@/lib/auth';
import { SessionExpiredModal } from './SessionExpiredModal';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * AuthGuard component that protects routes requiring authentication
 * Checks session validity and redirects to Cognito Hosted UI if unauthenticated
 * Amplify handles token refresh automatically
 */
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [showSessionExpired, setShowSessionExpired] = useState(false);

  useEffect(() => {
    checkAuth();

    // Set up periodic session check (every 5 minutes)
    const interval = setInterval(checkAuth, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  async function checkAuth() {
    try {
      const authenticated = await isAuthenticated();

      if (authenticated) {
        setShowSessionExpired(false);
        setIsLoading(false);
      } else {
        // No valid session - redirect to landing page
        // Don't call signIn() here to avoid redirect loop
        // User should click sign in button on landing page
        setIsLoading(false);
        window.location.href = '/landing';
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsLoading(false);
      window.location.href = '/landing';
    }
  }

  // Show loading state
  if (isLoading) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-cloud-silver dark:bg-carbon-gray">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-vault-blue"></div>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  // Show session expired modal if needed
  if (showSessionExpired) {
    return <SessionExpiredModal isOpen={showSessionExpired} />;
  }

  // Render protected content
  return <>{children}</>;
}
