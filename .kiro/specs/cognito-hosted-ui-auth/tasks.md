# Implementation Plan

## Overview

This implementation plan focuses on integrating AWS Amplify for Cognito Hosted UI authentication, removing unnecessary Next.js API routes, and ensuring proper communication between the frontend and the existing API Gateway backend.

## Tasks

- [x] 1. Install and configure AWS Amplify
  - Install aws-amplify package via pnpm
  - Create lib/amplify-config.ts with Cognito configuration
  - Configure OAuth settings (domain, scopes, redirect URIs)
  - Initialize Amplify in root layout
  - _Requirements: 1.1, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.9_

- [x] 2. Update environment configuration
  - Add NEXT_PUBLIC_AWS_REGION to environment variables
  - Update NEXT_PUBLIC_OAUTH_REDIRECT_URI to point to root (/)
  - Verify all required Cognito environment variables are set
  - Update .env.example with new variables
  - Update lib/env.ts to include AWS_REGION validation
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

- [x] 3. Create authentication utilities with Amplify
  - Create lib/auth.ts with Amplify wrapper functions
  - Implement signIn() using signInWithRedirect
  - Implement signOut() using Amplify signOut
  - Implement getAccessToken() using fetchAuthSession
  - Implement isAuthenticated() helper
  - Implement getCurrentUserInfo() helper
  - Remove old PKCE-related functions
  - _Requirements: 1.2, 1.3, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 5.1, 5.2_

- [x] 4. Create API client with automatic authentication
  - Create lib/api.ts with apiRequest function
  - Automatically add Authorization header with access token
  - Implement 401 retry logic with token refresh
  - Add error handling for network failures
  - Add TypeScript generic for response typing
  - _Requirements: 7.1, 7.2, 7.5, 7.8, 8.4, 8.5_

- [x] 5. Remove unnecessary Next.js API routes
  - Delete apps/web/app/api/auth/callback/route.ts
  - Delete apps/web/app/api/auth/session/route.ts
  - Delete apps/web/app/api/auth/refresh/route.ts
  - Delete apps/web/app/api/auth/signout/route.ts
  - Delete apps/web/app/api/auth directory if empty
  - _Requirements: 1.5, 1.6, 2.5_

- [x] 6. Update AuthGuard component
  - Replace getSession() with isAuthenticated() from Amplify
  - Remove refreshSession() logic (Amplify handles this)
  - Replace signIn(pathname) with signIn() (Amplify handles redirect)
  - Keep periodic session checks (5 minutes)
  - Keep loading and error states
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 7. Update SignInButton component
  - Replace custom signIn with Amplify signIn
  - Remove destination prop (not needed with Amplify)
  - Keep loading state and error handling
  - _Requirements: 1.2, 3.6_

- [x] 8. Update SignOutButton component
  - Replace custom signOut with Amplify signOut
  - Keep loading state and error handling
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 9. Update SessionExpiredModal component
  - Replace custom re-authentication with Amplify signIn
  - Remove signOut prop (use Amplify signOut directly)
  - Keep modal UI and focus management
  - _Requirements: 4.5, 4.6, 5.1_

- [x] 10. Remove OAuth callback page
  - Delete apps/web/app/(public)/auth/callback/page.tsx
  - Amplify handles callback automatically at redirect URI
  - Update redirect URI to point to root (/) or /vault
  - _Requirements: 1.4, 1.5, 1.6_

- [x] 11. Update home page authentication check
  - Replace getSession() with isAuthenticated() from Amplify
  - Use getCurrentUserInfo() to get user email
  - Keep SignInButton and SignOutButton components
  - _Requirements: 3.6, 6.1_

- [x] 12. Update middleware (optional)
  - Consider removing middleware since Amplify handles auth
  - Or keep lightweight check for better UX
  - Middleware cannot access Amplify tokens directly
  - _Requirements: 3.1_

- [x] 13. Verify backend API Gateway configuration
  - Confirm JWT authorizer is configured for Cognito User Pool
  - Verify JWKS URL is correct
  - Test that backend extracts claims from event.requestContext
  - Ensure backend uses sub claim for user ID
  - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ]\* 14. Test authentication flow end-to-end
  - Test sign-in redirects to Cognito Hosted UI
  - Test successful authentication returns to app
  - Test access token is retrieved correctly
  - Test API requests include Authorization header
  - Test backend receives and validates JWT
  - Test sign-out clears session
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ]\* 15. Test protected route access
  - Test unauthenticated access redirects to sign-in
  - Test authenticated access renders content
  - Test AuthGuard loading states
  - Test periodic session checks
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ]\* 16. Test token refresh and session management
  - Test automatic token refresh by Amplify
  - Test expired session handling
  - Test session-expired modal display
  - Test re-authentication flow
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ]\* 17. Test error scenarios
  - Test network failure during sign-in
  - Test user cancels sign-in
  - Test API 401 response handling
  - Test token refresh failure
  - Test error messages are user-friendly
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ]\* 18. Test accessibility
  - Test keyboard navigation for sign-in/sign-out buttons
  - Test focus management in SessionExpiredModal
  - Test screen reader announcements
  - Test ARIA labels on loading states
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [ ]\* 19. Update documentation
  - Document Amplify setup in README
  - Document environment variables
  - Document authentication flow
  - Document API client usage
  - Add troubleshooting guide
  - _Requirements: All_

- [ ]\* 20. Performance testing
  - Measure authentication flow time
  - Verify no unnecessary re-renders
  - Test with slow network conditions
  - Optimize bundle size
  - _Requirements: 6.5, 6.6_

## Migration Notes

### Key Changes from Current Implementation

1. **Remove Next.js API Routes**: The `/api/auth/*` routes are no longer needed. Amplify handles token exchange directly with Cognito.

2. **No HTTP-only Cookies**: Tokens are managed by Amplify in secure browser storage, not cookies.

3. **Simplified Token Management**: No manual PKCE implementation, state management, or token refresh logic needed.

4. **Direct Backend Communication**: Frontend sends access tokens directly to API Gateway in Authorization headers.

5. **Backend Already Correct**: The existing API Gateway JWT authorizer and Lambda claim extraction work perfectly with this approach.

### Benefits of This Approach

- **Less Code**: Remove ~500 lines of custom auth code
- **More Secure**: Amplify handles security best practices
- **Better Maintained**: AWS maintains Amplify, reducing maintenance burden
- **Standard Pattern**: Follows AWS recommended architecture
- **Automatic Refresh**: Token refresh handled transparently
- **Better Error Handling**: Amplify provides robust error handling

### Breaking Changes

- Users will need to sign in again after deployment
- Any code directly calling `/api/auth/*` endpoints will break
- Middleware may need adjustment or removal
