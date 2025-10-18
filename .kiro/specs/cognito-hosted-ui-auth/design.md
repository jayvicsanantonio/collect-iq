# Design Document

## Overview

This document outlines the design for implementing AWS Cognito Hosted UI authentication in the CollectIQ web application using AWS Amplify. The design leverages Amplify's built-in Cognito integration to handle OAuth 2.0 with PKCE, token management, and session refresh automatically.

The authentication system integrates seamlessly with the existing AWS API Gateway backend, which uses a JWT authorizer to validate Cognito access tokens. The frontend sends access tokens in Authorization headers, and the backend extracts user identity from JWT claims.

## Architecture

### High-Level Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. User clicks "Sign In"
       ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js Frontend (Client-Side)                         │
│  - Call Amplify.signInWithRedirect()                    │
└─────────────────────────────────────────────────────────┘
       │
       │ 2. Amplify redirects to Cognito Hosted UI
       ▼
┌─────────────────────────────────────────────────────────┐
│  AWS Cognito Hosted UI                                  │
│  - User enters credentials                              │
│  - Email verification (if needed)                       │
│  - Returns authorization code                           │
└─────────────────────────────────────────────────────────┘
       │
       │ 3. Redirect to callback with code
       ▼
┌─────────────────────────────────────────────────────────┐
│  Amplify (Automatic)                                    │
│  - Exchanges code for tokens                            │
│  - Stores tokens securely                               │
│  - Completes authentication                             │
└─────────────────────────────────────────────────────────┘
       │
       │ 4. Application ready
       ▼
┌─────────────────────────────────────────────────────────┐
│  Next.js Frontend                                       │
│  - Get access token: fetchAuthSession()                 │
│  - Make API call with Authorization: Bearer {token}     │
└─────────────────────────────────────────────────────────┘
       │
       │ 5. API request with JWT
       ▼
┌─────────────────────────────────────────────────────────┐
│  API Gateway (JWT Authorizer)                           │
│  - Validates JWT signature                              │
│  - Extracts claims (sub, email, username)               │
│  - Passes to Lambda                                     │
└─────────────────────────────────────────────────────────┘
       │
       │ 6. Authorized request with claims
       ▼
┌─────────────────────────────────────────────────────────┐
│  Lambda Backend                                         │
│  - Reads claims from event.requestContext               │
│  - Uses sub as user ID                                  │
│  - Processes request                                    │
└─────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Amplify Configuration (lib/amplify-config.ts)          │
│  - Configure Cognito User Pool                          │
│  - Configure OAuth settings                             │
│  - Initialize on app start                              │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Authentication Utilities (lib/auth.ts)                 │
│  - signIn(): Call signInWithRedirect                    │
│  - signOut(): Call Amplify signOut                      │
│  - getAccessToken(): Call fetchAuthSession              │
│  - getCurrentUser(): Get user attributes                │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  API Client (lib/api.ts)                                │
│  - Centralized API request function                     │
│  - Automatically adds Authorization header              │
│  - Handles 401 with retry after refresh                 │
└─────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  Auth Components                                        │
│  - AuthGuard: Protect routes                            │
│  - SignInButton: Initiate sign-in                       │
│  - SignOutButton: Sign out user                         │
│  - SessionExpiredModal: Handle expired sessions         │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Amplify Configuration (lib/amplify-config.ts)

**Purpose**: Configure AWS Amplify with Cognito settings.

**Implementation**:

```typescript
import { Amplify } from 'aws-amplify';
import { env } from './env';

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
        userPoolClientId: env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: env.NEXT_PUBLIC_COGNITO_DOMAIN,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [env.NEXT_PUBLIC_OAUTH_REDIRECT_URI],
            redirectSignOut: [env.NEXT_PUBLIC_OAUTH_LOGOUT_URI],
            responseType: 'code',
          },
        },
      },
    },
  });
}
```

**Design Decisions**:

- Call once at application startup
- Use environment variables for configuration
- OAuth scopes: openid (required), email, profile
- Response type: code (OAuth authorization code flow)

### 2. Authentication Utilities (lib/auth.ts)

**Purpose**: Wrapper functions around Amplify auth methods.

**Key Functions**:

```typescript
import {
  signInWithRedirect,
  signOut as amplifySignOut,
  fetchAuthSession,
  getCurrentUser,
} from 'aws-amplify/auth';

// Sign in with Cognito Hosted UI
export async function signIn(): Promise<void> {
  await signInWithRedirect({ provider: 'Cognito' });
}

// Sign out and clear session
export async function signOut(): Promise<void> {
  await amplifySignOut();
}

// Get current access token
export async function getAccessToken(): Promise<string | undefined> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken.toString();
  } catch (error) {
    console.error('Failed to get access token:', error);
    return undefined;
  }
}

// Get current user information
export async function getCurrentUserInfo() {
  try {
    const user = await getCurrentUser();
    return user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await fetchAuthSession();
    return !!session.tokens?.accessToken;
  } catch {
    return false;
  }
}
```

**Design Decisions**:

- Simple wrapper functions for clarity
- Error handling with console logging
- Return undefined/null on errors (don't throw)
- fetchAuthSession automatically refreshes expired tokens

### 3. API Client (lib/api.ts)

**Purpose**: Centralized API request handler with automatic authentication.

**Implementation**:

```typescript
import { getAccessToken } from './auth';
import { env } from './env';

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const url = `${env.NEXT_PUBLIC_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Token might be expired, try refreshing
    const newToken = await getAccessToken();
    if (newToken && newToken !== accessToken) {
      // Retry with new token
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`API request failed: ${retryResponse.statusText}`);
      }

      return await retryResponse.json();
    }

    throw new Error('Authentication required');
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return await response.json();
}
```

**Design Decisions**:

- Automatically adds Authorization header
- Retries once on 401 (token might have been refreshed)
- Throws errors for non-OK responses
- Generic type parameter for response typing

### 4. AuthGuard Component (components/auth/AuthGuard.tsx)

**Purpose**: Client-side component that protects routes based on authentication status.

**Implementation**:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, signIn } from '@/lib/auth';
import { SessionExpiredModal } from './SessionExpiredModal';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
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
        // Not authenticated - redirect to sign in
        setIsLoading(false);
        await signIn();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsLoading(false);
      await signIn();
    }
  }

  // Show loading state
  if (isLoading) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-vault-blue"></div>
          <p className="text-lg text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Show session expired modal if needed
  if (showSessionExpired) {
    return (
      <SessionExpiredModal
        isOpen={showSessionExpired}
        onReauthenticate={() => signIn()}
      />
    );
  }

  // Render protected content
  return <>{children}</>;
}
```

**Design Decisions**:

- Check authentication on mount
- Periodic checks every 5 minutes
- Redirect to sign-in if not authenticated
- Optional fallback for custom loading UI
- Clean up interval on unmount

### 5. SignInButton Component (components/auth/SignInButton.tsx)

**Purpose**: Button that initiates the sign-in flow.

**Implementation**:

```typescript
'use client';

import { useState } from 'react';
import { signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface SignInButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

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
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
          Redirecting...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```

### 6. SignOutButton Component (components/auth/SignOutButton.tsx)

**Purpose**: Button that signs out the user.

**Implementation**:

```typescript
'use client';

import { useState } from 'react';
import { signOut } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface SignOutButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

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
```

## Data Models

### AuthSession (from Amplify)

```typescript
interface AuthSession {
  tokens?: {
    accessToken: JWT;
    idToken?: JWT;
  };
  credentials?: AWSCredentials;
  identityId?: string;
  userSub?: string;
}
```

### JWT Claims (Backend)

```typescript
interface JWTClaims {
  sub: string; // User ID (Cognito UUID)
  email?: string; // Email address (optional)
  username?: string; // Cognito username
  'cognito:groups'?: string[]; // User groups
  iat: number; // Issued at
  exp: number; // Expiration
}
```

## Error Handling

### Error Categories

1. **Authentication Errors**:
   - User cancelled sign-in
   - Network errors during OAuth flow
   - Invalid credentials

2. **Token Errors**:
   - Expired tokens (handled automatically by Amplify)
   - Invalid tokens
   - Missing tokens

3. **API Errors**:
   - 401 Unauthorized (token invalid)
   - 403 Forbidden (insufficient permissions)
   - Network errors

### Error Handling Strategy

**Client-Side**:

- Catch Amplify errors and display user-friendly messages
- Retry API requests once on 401
- Log errors to console for debugging
- Provide actionable next steps

**Backend**:

- API Gateway validates JWT automatically
- Returns 401 for invalid/expired tokens
- Lambda extracts claims from validated JWT

## Testing Strategy

### Unit Tests

**lib/auth.ts**:

- Mock Amplify functions
- Test error handling
- Test token retrieval

**lib/api.ts**:

- Mock fetch
- Test Authorization header
- Test 401 retry logic

**Components**:

- AuthGuard state transitions
- Button loading states
- Modal interactions

### Integration Tests

**Authentication Flow**:

1. Mock Amplify signInWithRedirect
2. Simulate callback
3. Verify token storage
4. Test API requests with token

**Session Management**:

1. Mock fetchAuthSession
2. Test automatic refresh
3. Test expired session handling

### End-to-End Tests

**Happy Path**:

1. Visit home page
2. Click sign-in
3. Complete Cognito flow (test user)
4. Verify redirect to vault
5. Make API request
6. Sign out

## Security Considerations

### Token Management

- **Storage**: Amplify handles secure storage
- **Transmission**: HTTPS only
- **Expiration**: Automatic refresh by Amplify
- **Scope**: Minimal scopes (openid, email, profile)

### API Security

- **JWT Validation**: API Gateway validates signature
- **Claims Extraction**: Backend reads from validated JWT
- **User Isolation**: Use sub claim for data access
- **HTTPS**: All API calls over HTTPS

### CSRF Protection

- **State Parameter**: Handled by Amplify
- **PKCE**: Handled by Amplify
- **SameSite Cookies**: Not applicable (no cookies used)

## Performance Considerations

### Client-Side

- **Lazy Loading**: Load Amplify only when needed
- **Token Caching**: Amplify caches tokens
- **Minimal Re-renders**: Use React Context for auth state
- **Code Splitting**: Separate auth bundle

### Network

- **Token Refresh**: Automatic and transparent
- **API Requests**: Single Authorization header
- **Connection Reuse**: HTTP/2 multiplexing

## Deployment Considerations

### Environment Setup

1. **Cognito User Pool**: Create in AWS Console
2. **App Client**: Configure OAuth settings
3. **Hosted UI**: Customize branding
4. **Callback URLs**: Add to allowed list
5. **Logout URLs**: Add to allowed list
6. **API Gateway**: Configure JWT authorizer

### Configuration

```bash
# Development
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq-dev.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000
NEXT_PUBLIC_API_BASE=https://api-dev.collectiq.com

# Production
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://app.collectiq.com/
NEXT_PUBLIC_OAUTH_LOGOUT_URI=https://app.collectiq.com
NEXT_PUBLIC_API_BASE=https://api.collectiq.com
```

## Future Enhancements

### Social Sign-In

- Add Google, Apple, Facebook providers in Cognito
- No code changes needed (Cognito handles it)

### Multi-Factor Authentication

- Enable MFA in Cognito User Pool
- Hosted UI handles MFA flow automatically

### Advanced Features

- Remember me functionality
- Device tracking
- Session management dashboard
- Activity monitoring
