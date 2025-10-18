'use client';

import { useState } from 'react';
import { signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface SignInButtonProps {
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
  children?: React.ReactNode;
}

/**
 * Sign in button component
 * Redirects to Cognito Hosted UI for authentication
 * Amplify handles redirect destination automatically
 */
export function SignInButton({
  variant = 'primary',
  size = 'default',
  className,
  children = 'Sign In',
}: SignInButtonProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSignIn = async () => {
    try {
      setIsRedirecting(true);
      await signIn();
    } catch (error) {
      console.error('Sign in error:', error);
      setIsRedirecting(false);
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      disabled={isRedirecting}
      variant={variant}
      size={size}
      className={className}
    >
      {isRedirecting ? (
        <>
          <span className="mr-2 inline-block h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          Redirecting...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
