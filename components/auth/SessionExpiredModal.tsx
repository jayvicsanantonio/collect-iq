'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { signIn, signOut } from '@/lib/auth';

interface SessionExpiredModalProps {
  isOpen: boolean;
}

/**
 * Modal displayed when user session expires
 * Provides options to re-authenticate or sign out
 * Uses Amplify signIn and signOut directly
 */
export function SessionExpiredModal({ isOpen }: SessionExpiredModalProps) {
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Prevent closing the modal by clicking outside or pressing escape
  const handleOpenChange = () => {
    // Modal can only be closed by user action (re-authenticate or sign out)
    return;
  };

  const handleReauthenticate = async () => {
    setIsReauthenticating(true);
    await signIn();
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-pulse/10">
              <svg
                className="h-8 w-8 text-amber-pulse"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Your Session Has Expired
          </DialogTitle>
          <DialogDescription className="text-center">
            For your security, your session has timed out. Please sign in again
            to continue where you left off.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleReauthenticate}
            disabled={isReauthenticating || isSigningOut}
            className="w-full"
            size="lg"
          >
            {isReauthenticating ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Redirecting...
              </>
            ) : (
              'Sign In Again'
            )}
          </Button>

          <Button
            onClick={handleSignOut}
            disabled={isReauthenticating || isSigningOut}
            variant="outline"
            className="w-full"
            size="lg"
          >
            {isSigningOut ? (
              <>
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                Signing out...
              </>
            ) : (
              'Sign Out'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
