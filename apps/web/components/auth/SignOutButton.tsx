'use client';

import { useState } from 'react';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface SignOutButtonProps {
  variant?:
    | 'primary'
    | 'secondary'
    | 'gradient'
    | 'outline'
    | 'ghost'
    | 'destructive'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * Sign out button component
 * Handles sign out flow with loading state
 */
export function SignOutButton({
  variant = 'outline',
  size = 'default',
  className,
}: SignOutButtonProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
      // Show error toast if needed
    }
  };

  return (
    <Button
      onClick={handleSignOut}
      disabled={isSigningOut}
      variant={variant}
      size={size}
      className={className}
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
  );
}
