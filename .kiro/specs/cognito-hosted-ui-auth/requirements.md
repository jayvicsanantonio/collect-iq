# Requirements Document

## Introduction

This specification defines the implementation of AWS Cognito Hosted UI authentication for the CollectIQ web application using AWS Amplify. The Hosted UI provides a secure, OAuth 2.0 + PKCE-based authentication flow that handles sign-in, sign-up, email verification, and password reset without requiring custom form implementations.

The authentication system integrates with the existing Next.js 14 App Router architecture and AWS API Gateway backend. The frontend uses AWS Amplify to manage authentication, storing tokens in memory and sending access tokens to the backend via Authorization headers. The backend API Gateway uses a JWT authorizer to validate Cognito access tokens and extract user claims.

## Glossary

- **Hosted UI**: Amazon Cognito's pre-built, customizable authentication interface that handles OAuth 2.0 flows
- **AWS Amplify**: AWS SDK that simplifies authentication, providing built-in Cognito integration
- **PKCE**: Proof Key for Code Exchange, a security extension to OAuth 2.0 for public clients (handled by Amplify)
- **Authorization Code**: Temporary code returned by Cognito after successful authentication
- **JWT**: JSON Web Token containing user identity and claims
- **Access Token**: Short-lived token for API authorization, sent to backend in Authorization header
- **ID Token**: Token containing user identity information
- **Refresh Token**: Long-lived token used to obtain new access tokens
- **JWT Authorizer**: API Gateway component that validates Cognito access tokens
- **AuthGuard**: Client-side component that protects routes and content based on authentication status
- **CollectIQ_System**: The complete CollectIQ application including frontend and backend

## Requirements

### Requirement 1: AWS Amplify Authentication Integration

**User Story:** As a collector, I want to sign in using a secure, professional authentication interface so that I can access my account without concerns about security.

#### Acceptance Criteria

1. WHEN the application initializes THEN the CollectIQ_System SHALL configure AWS Amplify with Cognito User Pool ID, Client ID, and OAuth settings
2. WHEN a user initiates sign-in THEN the CollectIQ_System SHALL call Amplify's signInWithRedirect function
3. WHEN signInWithRedirect is called THEN Amplify SHALL handle PKCE generation, state management, and redirect to Cognito Hosted UI
4. WHEN a user completes authentication on Hosted UI THEN Cognito SHALL redirect back to the configured redirect_uri with authorization code
5. WHEN the OAuth callback is received THEN Amplify SHALL automatically exchange the authorization code for tokens
6. WHEN token exchange succeeds THEN Amplify SHALL store tokens securely in memory and browser storage
7. WHEN tokens are stored THEN the CollectIQ_System SHALL retrieve the access token using Amplify's fetchAuthSession function
8. WHEN making API requests THEN the CollectIQ_System SHALL include the access token in the Authorization header as "Bearer {accessToken}"

### Requirement 2: Secure Token Management

**User Story:** As a security-conscious user, I want my authentication tokens managed securely so that they cannot be stolen or misused.

#### Acceptance Criteria

1. WHEN tokens are received from Cognito THEN Amplify SHALL store tokens securely using browser storage mechanisms
2. WHEN storing tokens THEN Amplify SHALL use secure storage appropriate for the browser environment
3. WHEN the application needs an access token THEN the CollectIQ_System SHALL call fetchAuthSession to retrieve the current valid token
4. WHEN an access token is expired THEN Amplify SHALL automatically refresh it using the refresh token
5. WHEN a user signs out THEN the CollectIQ_System SHALL call Amplify's signOut function to clear all tokens
6. WHEN tokens are cleared THEN Amplify SHALL remove all authentication data from storage

### Requirement 3: Route Protection and Redirects

**User Story:** As a collector, I want to be automatically redirected to sign in when accessing protected features so that I can seamlessly authenticate and continue my intended action.

#### Acceptance Criteria

1. WHEN a user visits a protected route (/upload, /vault, /cards/:id) without authentication THEN the CollectIQ_System SHALL check authentication status using Amplify
2. WHEN checking authentication status THEN the CollectIQ_System SHALL call fetchAuthSession to determine if user is authenticated
3. WHEN user is not authenticated THEN the CollectIQ_System SHALL initiate sign-in flow using signInWithRedirect
4. WHEN authentication completes successfully THEN Amplify SHALL redirect the user back to the application
5. WHEN user returns after authentication THEN the CollectIQ_System SHALL redirect to /vault as the default destination
6. WHEN a user visits the home page without authentication THEN the CollectIQ_System SHALL display a sign-in button that calls signInWithRedirect

### Requirement 4: Session Management and Refresh

**User Story:** As a collector, I want my session to remain active while I'm using the application so that I don't have to repeatedly sign in.

#### Acceptance Criteria

1. WHEN an access token is expired THEN Amplify SHALL automatically refresh it using the refresh token
2. WHEN calling fetchAuthSession THEN Amplify SHALL return a valid access token, refreshing if necessary
3. WHEN token refresh succeeds THEN Amplify SHALL update stored tokens transparently
4. WHEN token refresh fails THEN Amplify SHALL clear the session and the CollectIQ_System SHALL redirect to sign-in
5. WHEN a user's session expires and cannot be refreshed THEN the CollectIQ_System SHALL display a session-expired modal with re-authentication option
6. WHEN a user clicks re-authenticate in the modal THEN the CollectIQ_System SHALL call signInWithRedirect to restart authentication

### Requirement 5: Sign Out Flow

**User Story:** As a collector, I want to securely sign out of my account so that others cannot access my collection on shared devices.

#### Acceptance Criteria

1. WHEN a user clicks sign out THEN the CollectIQ_System SHALL call Amplify's signOut function
2. WHEN signOut is called THEN Amplify SHALL clear all stored tokens and authentication state
3. WHEN tokens are cleared THEN Amplify SHALL redirect to Cognito's logout endpoint
4. WHEN Cognito logout completes THEN Cognito SHALL redirect back to the configured logout_uri (application home page)
5. WHEN a user returns to the home page after logout THEN the CollectIQ_System SHALL display the unauthenticated state with sign-in option

### Requirement 6: AuthGuard Component

**User Story:** As a developer, I want a reusable AuthGuard component so that I can easily protect routes and content based on authentication status.

#### Acceptance Criteria

1. WHEN AuthGuard mounts THEN the CollectIQ_System SHALL call fetchAuthSession from Amplify to check authentication status
2. WHILE session check is pending THEN the CollectIQ_System SHALL display a loading spinner with text "Verifying authentication..."
3. WHEN session check returns authenticated THEN the CollectIQ_System SHALL render the protected children components
4. WHEN session check returns unauthenticated THEN the CollectIQ_System SHALL call signInWithRedirect to initiate authentication
5. WHEN AuthGuard is mounted THEN the CollectIQ_System SHALL set up a periodic session check every 5 minutes
6. WHEN AuthGuard unmounts THEN the CollectIQ_System SHALL clear the periodic session check interval
7. WHEN AuthGuard accepts a fallback prop THEN the CollectIQ_System SHALL render the fallback component during loading instead of default spinner
8. WHEN periodic check detects expired session THEN the CollectIQ_System SHALL display session-expired modal

### Requirement 7: Backend API Integration

**User Story:** As a developer, I want the frontend to communicate securely with the backend API so that user data is protected and properly authorized.

#### Acceptance Criteria

1. WHEN making an API request to the backend THEN the CollectIQ_System SHALL retrieve the current access token using fetchAuthSession
2. WHEN access token is retrieved THEN the CollectIQ_System SHALL include it in the Authorization header as "Bearer {accessToken}"
3. WHEN the backend API Gateway receives a request THEN the JWT authorizer SHALL validate the access token signature
4. WHEN token signature is valid THEN the JWT authorizer SHALL extract claims (sub, email, username, groups) from the token
5. WHEN claims are extracted THEN the JWT authorizer SHALL pass them to the Lambda function in event.requestContext.authorizer.jwt.claims
6. WHEN the Lambda function receives the request THEN it SHALL extract the user ID from claims.sub
7. WHEN token is invalid or expired THEN the API Gateway SHALL return 401 Unauthorized
8. WHEN the frontend receives 401 THEN the CollectIQ_System SHALL attempt to refresh the session and retry the request once

### Requirement 8: Error Handling and User Feedback

**User Story:** As a collector, I want clear error messages when authentication fails so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN Amplify encounters an authentication error THEN the CollectIQ_System SHALL catch the error and display a user-friendly message
2. WHEN user denies access on Hosted UI THEN the CollectIQ_System SHALL display "Sign in was cancelled. Please try again."
3. WHEN network error occurs during authentication THEN the CollectIQ_System SHALL display "Unable to connect. Please check your internet connection and try again."
4. WHEN token refresh fails THEN the CollectIQ_System SHALL clear the session and redirect to sign-in
5. WHEN API request returns 401 THEN the CollectIQ_System SHALL attempt session refresh once before showing error
6. WHEN displaying authentication errors THEN the CollectIQ_System SHALL log error details to console for debugging while showing user-friendly messages
7. WHEN error is displayed THEN the CollectIQ_System SHALL provide a "Try Again" button that initiates sign-in

### Requirement 9: Environment Configuration

**User Story:** As a developer, I want authentication configuration managed via environment variables so that I can easily deploy to different environments.

#### Acceptance Criteria

1. WHEN the application starts THEN the CollectIQ_System SHALL require NEXT_PUBLIC_AWS_REGION environment variable
2. WHEN the application starts THEN the CollectIQ_System SHALL require NEXT_PUBLIC_COGNITO_USER_POOL_ID environment variable
3. WHEN the application starts THEN the CollectIQ_System SHALL require NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID environment variable
4. WHEN the application starts THEN the CollectIQ_System SHALL require NEXT_PUBLIC_COGNITO_DOMAIN environment variable (e.g., collectiq-dev.auth.us-east-1.amazoncognito.com)
5. WHEN the application starts THEN the CollectIQ_System SHALL require NEXT_PUBLIC_OAUTH_REDIRECT_URI environment variable (e.g., http://localhost:3000/)
6. WHEN the application starts THEN the CollectIQ_System SHALL require NEXT_PUBLIC_OAUTH_LOGOUT_URI environment variable (e.g., http://localhost:3000)
7. WHEN the application starts THEN the CollectIQ_System SHALL require NEXT_PUBLIC_API_BASE environment variable for backend API URL
8. WHEN environment variables are missing THEN the CollectIQ_System SHALL throw a clear error message indicating which variables are required
9. WHEN Amplify is configured THEN the CollectIQ_System SHALL use these environment variables to set up OAuth configuration

### Requirement 10: Accessibility and Keyboard Navigation

**User Story:** As a user with accessibility needs, I want the authentication flow to be fully accessible so that I can sign in independently.

#### Acceptance Criteria

1. WHEN the sign-in button is displayed THEN the CollectIQ_System SHALL ensure it is keyboard accessible with visible focus indicator
2. WHEN the session-expired modal appears THEN the CollectIQ_System SHALL trap focus within the modal
3. WHEN the session-expired modal appears THEN the CollectIQ_System SHALL set focus to the primary action button
4. WHEN authentication is in progress THEN the CollectIQ_System SHALL use aria-live regions to announce status changes to screen readers
5. WHEN displaying loading states THEN the CollectIQ_System SHALL provide appropriate aria-label attributes
6. WHEN errors occur THEN the CollectIQ_System SHALL announce error messages to screen readers via aria-live="assertive"
