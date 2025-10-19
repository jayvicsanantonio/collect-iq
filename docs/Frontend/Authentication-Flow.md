# Authentication Flow

## Overview

CollectIQ uses Amazon Cognito Hosted UI for authentication with OAuth 2.0 + PKCE flow. AWS Amplify handles the OAuth flow automatically, including token management and refresh.

## Route Structure

### Public Routes (`(public)` route group)

- `/landing` - Landing page for unauthenticated users
- `/auth/callback` - OAuth callback handler (Cognito redirects here after authentication)

### Protected Routes (`(protected)` route group)

- `/upload` - Upload card page (requires authentication)
- `/vault` - User's card collection (requires authentication)

### Root Route

- `/` - Redirects based on authentication status:
  - Authenticated → `/upload`
  - Unauthenticated → `/landing`

## Authentication Flow

### Sign In Flow

1. User visits `/landing` and clicks "Sign In" button
2. `signIn()` from `lib/auth.ts` redirects to Cognito Hosted UI
3. User authenticates with Cognito (email/password, social providers, etc.)
4. Cognito redirects to `/auth/callback` with authorization code
5. Amplify automatically exchanges code for tokens
6. Callback page checks authentication and redirects to `/upload`

### Sign Out Flow

1. User clicks "Sign Out" in sidebar
2. `signOut()` from `lib/auth.ts` clears local session
3. Cognito redirects to `/landing` (configured in `NEXT_PUBLIC_OAUTH_LOGOUT_URI`)

### Protected Route Access

1. User tries to access protected route (e.g., `/upload`)
2. `AuthGuard` component checks authentication status
3. If authenticated → render protected content
4. If not authenticated → redirect to `/landing`

## Configuration

### Environment Variables

Required environment variables in `.env.local`:

```bash
# AWS Region
NEXT_PUBLIC_AWS_REGION=us-east-1

# Cognito User Pool
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX

# Cognito Domain (Hosted UI)
NEXT_PUBLIC_COGNITO_DOMAIN=your-domain.auth.us-east-1.amazoncognito.com

# OAuth Redirect URIs
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000/landing
```

### Cognito User Pool Configuration

In AWS Console, configure the following for your Cognito User Pool App Client:

1. **Allowed callback URLs**: `http://localhost:3000/auth/callback` (dev), `https://app.collectiq.com/auth/callback` (prod)
2. **Allowed sign-out URLs**: `http://localhost:3000/landing` (dev), `https://app.collectiq.com/landing` (prod)
3. **OAuth 2.0 grant types**: Authorization code grant
4. **OAuth scopes**: openid, email, profile

## Components

### `AmplifyProvider`

- Initializes AWS Amplify configuration on client side
- Must wrap the entire app in root layout

### `AuthGuard`

- Protects routes requiring authentication
- Checks session validity on mount and periodically (every 5 minutes)
- Redirects to `/landing` if session is invalid
- Shows loading state while checking authentication

### `Sidebar`

- Navigation component for authenticated users
- Shows user email and sign out button
- Only rendered in protected layout

## Token Management

Amplify automatically handles:

- Token storage (secure, httpOnly cookies)
- Token refresh (when access token expires)
- PKCE flow (for security)
- Session persistence across page reloads

## Security Considerations

1. **PKCE Flow**: Protects against authorization code interception
2. **Token Refresh**: Access tokens are short-lived, refresh tokens are used automatically
3. **Secure Storage**: Tokens stored securely by Amplify
4. **Session Validation**: Periodic checks ensure session is still valid
5. **Route Protection**: `AuthGuard` prevents unauthorized access to protected routes

## Testing Authentication

### Local Development

1. Start the dev server: `pnpm web:dev`
2. Visit `http://localhost:3000` (redirects to `/landing`)
3. Click "Sign In" or "Get Started"
4. Authenticate with Cognito Hosted UI
5. After successful auth, redirected to `/upload`

### Verify Configuration

Check that:

- Cognito User Pool exists with correct settings
- App Client has correct callback URLs
- Environment variables are set correctly
- Hosted UI domain is configured

## Troubleshooting

### "Invalid redirect URI" error

- Verify `NEXT_PUBLIC_OAUTH_REDIRECT_URI` matches Cognito App Client callback URLs
- Check for trailing slashes (should be consistent)

### Infinite redirect loop

- Check that `/auth/callback` is in public route group
- Verify Amplify configuration is correct
- Clear browser cookies and try again

### Session not persisting

- Check that cookies are enabled in browser
- Verify Amplify is configured before any auth calls
- Check browser console for errors

### "User is not authenticated" error

- Session may have expired - sign in again
- Check that tokens are being stored correctly
- Verify Cognito User Pool configuration
