# CollectIQ Authentication Guide

Complete guide for authentication implementation using AWS Amplify and Amazon Cognito Hosted UI.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Cognito Setup](#cognito-setup)
4. [Architecture](#architecture)
5. [Usage](#usage)
6. [Security](#security)
7. [Troubleshooting](#troubleshooting)

---

## Overview

CollectIQ uses **AWS Amplify** with **Amazon Cognito Hosted UI** for authentication. This provides:

- ✅ OAuth 2.0 with PKCE (Proof Key for Code Exchange)
- ✅ Secure token management (automatic refresh)
- ✅ JWT-based authentication
- ✅ User-scoped data access
- ✅ Production-ready security

### Authentication Flow

```
User → Landing Page → Sign In Button → Cognito Hosted UI
  → User Authenticates → Cognito Redirects to /auth/callback
    → Amplify Exchanges Code for Tokens → Redirect to /upload
      → Protected Routes Accessible
```

---

## Quick Start

### 1. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your Cognito details:

```env
# AWS Region
NEXT_PUBLIC_AWS_REGION=us-east-1

# Cognito User Pool
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX

# Cognito Domain (Hosted UI)
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq.auth.us-east-1.amazoncognito.com

# OAuth Redirect URIs
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000/landing

# Backend API
NEXT_PUBLIC_API_BASE=https://api.collectiq.com
```

### 2. Start Development Server

```bash
cd apps/web
pnpm dev
```

### 3. Test Authentication

1. Visit `http://localhost:3000` (redirects to `/landing`)
2. Click "Sign In" or "Get Started"
3. Authenticate with Cognito Hosted UI
4. After successful auth, redirected to `/upload`

---

## Cognito Setup

### Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured (optional)

### Step 1: Create Cognito User Pool

#### Via AWS Console

1. **Navigate to Amazon Cognito**
   - AWS Console → Services → Cognito
   - Click "Create user pool"

2. **Configure Sign-in Experience**
   - Sign-in options: Select **Email**
   - Click "Next"

3. **Configure Security Requirements**
   - Password policy: Choose "Cognito defaults" or customize
   - MFA: Optional (recommended for production)
   - User account recovery: Select "Email only"
   - Click "Next"

4. **Configure Sign-up Experience**
   - Self-service sign-up: **Enable**
   - Attribute verification: "Send email message, verify email address"
   - Required attributes: **email**
   - Click "Next"

5. **Configure Message Delivery**
   - Email provider: "Send email with Cognito"
   - For production, configure SES
   - Click "Next"

6. **Integrate Your App**
   - User pool name: `collectiq-users`
   - Hosted UI: **Check "Use the Cognito Hosted UI"**
   - Domain: Choose "Use a Cognito domain"
   - Cognito domain prefix: `collectiq` (must be unique)
   - Click "Next"

7. **Configure App Client**
   - App client name: `collectiq-web`
   - Client secret: **Don't generate** (public client)
   - Click "Next"

8. **Review and Create**
   - Click "Create user pool"

### Step 2: Configure App Client OAuth Settings

1. **Navigate to App Integration**
   - Click on your user pool
   - Go to "App integration" tab
   - Click on your app client name

2. **Configure OAuth 2.0**
   - **Allowed callback URLs**:
     - Development: `http://localhost:3000/auth/callback`
     - Production: `https://app.collectiq.com/auth/callback`
   - **Allowed sign-out URLs**:
     - Development: `http://localhost:3000/landing`
     - Production: `https://app.collectiq.com/landing`
   - **Identity providers**: Cognito user pool
   - **OAuth 2.0 grant types**: Authorization code grant
   - **OpenID Connect scopes**: openid, email, profile
   - **Advanced settings**: Enable **PKCE** (required)
   - Click "Save changes"

### Step 3: Create Test User

#### Via AWS Console

1. Go to User Pool → Users
2. Click "Create user"
3. Username: Your email address
4. Email: Same as username
5. Temporary password: Create a secure password
6. Uncheck "Send an email invitation"
7. Click "Create user"

#### Via AWS CLI

```bash
# Create user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username test@example.com \
  --user-attributes Name=email,Value=test@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username test@example.com \
  --password YourSecurePassword123! \
  --permanent
```

---

## Architecture

### Route Structure

```
apps/web/app/
├── page.tsx                          # Root - redirects based on auth
├── (public)/                         # Public routes
│   ├── landing/
│   │   └── page.tsx                  # Landing page for unauthenticated users
│   └── auth/
│       └── callback/
│           └── page.tsx              # OAuth callback handler
└── (protected)/                      # Protected routes (require auth)
    ├── layout.tsx                    # Wraps with AuthGuard + Sidebar
    ├── upload/
    │   └── page.tsx                  # Upload card page
    └── vault/
        └── page.tsx                  # User's card collection
```

### Core Components

#### `AmplifyProvider` (`components/providers/amplify-provider.tsx`)

- Initializes AWS Amplify configuration
- Must wrap entire app in root layout
- Configures Cognito User Pool and OAuth settings

#### `AuthGuard` (`components/auth/AuthGuard.tsx`)

- Protects routes requiring authentication
- Checks session validity on mount and periodically (every 5 minutes)
- Redirects to `/landing` if not authenticated
- Shows loading state during auth check

#### `Sidebar` (`components/navigation/Sidebar.tsx`)

- Navigation component for authenticated users
- Shows user email and sign out button
- Links to Upload and Vault pages
- Only rendered in protected layout

#### Auth Buttons

- `SignInButton` - Initiates OAuth flow to Cognito Hosted UI
- `SignOutButton` - Signs out user and redirects to logout URL

### Authentication Utilities (`lib/auth.ts`)

```typescript
// Check if user is authenticated
const authenticated = await isAuthenticated();

// Get current user information
const userInfo = await getCurrentUserInfo();
// Returns: { sub, email, emailVerified }

// Get access token for API calls
const token = await getAccessToken();

// Get full session details
const session = await getSession();
// Returns: { sub, email, emailVerified, accessToken, expiresAt }

// Sign in (redirects to Cognito Hosted UI)
await signIn();

// Sign out (clears session and redirects)
await signOut();
```

### Authentication Flow Details

#### Sign In Flow

1. User clicks "Sign In" button on landing page
2. `signIn()` from `lib/auth.ts` calls Amplify's `signInWithRedirect()`
3. Amplify generates PKCE parameters and redirects to Cognito Hosted UI
4. User authenticates with Cognito
5. Cognito redirects to `/auth/callback?code=...&state=...`
6. Amplify automatically exchanges authorization code for tokens
7. Callback page checks authentication and redirects to `/upload`

#### Protected Route Access

1. User navigates to protected route (e.g., `/vault`)
2. `AuthGuard` component checks authentication status
3. If authenticated → render protected content with sidebar
4. If not authenticated → redirect to `/landing`

#### Sign Out Flow

1. User clicks "Sign Out" in sidebar
2. `signOut()` from `lib/auth.ts` calls Amplify's `signOut()`
3. Amplify clears local session
4. User redirected to Cognito logout endpoint
5. Cognito redirects to `/landing`

---

## Usage

### Protecting Routes

Routes in `app/(protected)/` are automatically protected:

```tsx
// app/(protected)/my-page/page.tsx
export default function MyProtectedPage() {
  return <div>This page requires authentication</div>;
}
```

### Using Auth Components

**Sign In Button:**

```tsx
import { SignInButton } from '@/components/auth';

<SignInButton variant="gradient" size="lg">
  Get Started
</SignInButton>;
```

**Sign Out Button:**

```tsx
import { SignOutButton } from '@/components/auth';

<SignOutButton variant="outline" />;
```

**Manual Auth Guard:**

```tsx
import { AuthGuard } from '@/components/auth';

<AuthGuard>
  <ProtectedContent />
</AuthGuard>;
```

### Using Auth Functions

**Check Authentication:**

```tsx
import { isAuthenticated, getCurrentUserInfo } from '@/lib/auth';

const authenticated = await isAuthenticated();
if (authenticated) {
  const userInfo = await getCurrentUserInfo();
  console.log('User:', userInfo.email);
}
```

**Get Access Token for API Calls:**

```tsx
import { getAccessToken } from '@/lib/auth';

const token = await getAccessToken();
if (token) {
  // Add to API request headers
  headers: {
    'Authorization': `Bearer ${token}`
  }
}
```

**Programmatic Sign In:**

```tsx
import { signIn } from '@/lib/auth';

await signIn(); // Redirects to Cognito Hosted UI
```

**Programmatic Sign Out:**

```tsx
import { signOut } from '@/lib/auth';

await signOut(); // Clears session and redirects
```

---

## Security

### Security Features

1. **PKCE (Proof Key for Code Exchange)**
   - Prevents authorization code interception attacks
   - Automatically handled by Amplify
   - Required for public clients (no client secret)

2. **State Parameter Validation**
   - Prevents CSRF attacks
   - Automatically handled by Amplify

3. **Secure Token Storage**
   - Tokens stored securely by Amplify
   - Not accessible to JavaScript
   - Automatic token refresh before expiration

4. **JWT Validation**
   - Access tokens are JWTs signed by Cognito
   - Backend validates JWT signature
   - Short-lived access tokens (1 hour default)

5. **Session Management**
   - Periodic session checks (every 5 minutes)
   - Automatic token refresh
   - Graceful handling of expired sessions

### Production Best Practices

1. **Enable MFA** for production users
2. **Use custom domain** for Cognito Hosted UI
3. **Configure SES** for reliable email delivery
4. **Enable CloudWatch logging** for audit trail
5. **Set up CloudWatch alarms** for suspicious activity
6. **Use AWS WAF** to protect Cognito endpoints
7. **Regularly rotate secrets** and credentials
8. **Enable advanced security features** (adaptive authentication)

### Environment-Specific Configuration

**Development:**

```env
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000/landing
```

**Production:**

```env
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://app.collectiq.com/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=https://app.collectiq.com/landing
```

---

## Troubleshooting

### "Invalid redirect_uri" Error

**Cause:** Callback URL mismatch between environment variable and Cognito configuration

**Solution:**

- Verify `NEXT_PUBLIC_OAUTH_REDIRECT_URI` matches Cognito App Client callback URLs exactly
- Check for trailing slashes (should be consistent)
- Ensure URL is added to "Allowed callback URLs" in Cognito

### Infinite Redirect Loop

**Cause:** AuthGuard or callback page not handling auth state correctly

**Solution:**

- Check that `/auth/callback` is in `(public)` route group
- Verify Amplify configuration is correct
- Clear browser cookies and localStorage
- Check browser console for Amplify errors

### Session Not Persisting

**Cause:** Cookies not being stored or Amplify not configured

**Solution:**

- Check that cookies are enabled in browser
- Verify Amplify is configured before any auth calls
- Check browser console for errors
- Verify Cognito User Pool and App Client IDs are correct

### "User is not authenticated" Error

**Cause:** Session expired or tokens invalid

**Solution:**

- Session may have expired - sign in again
- Check that tokens are being stored correctly
- Verify Cognito User Pool configuration
- Check browser console for Amplify errors

### Authentication Not Working

**Cause:** Configuration mismatch or missing environment variables

**Solution:**

- Clear browser storage (cookies, localStorage, sessionStorage)
- Verify all environment variables are set correctly
- Check browser console for Amplify errors
- Verify Cognito User Pool and App Client exist
- Check that OAuth domain is correct

### Email Not Sending

**Cause:** Email configuration issue in Cognito

**Solution:**

- Check email configuration in Cognito
- Verify email address is not in SES sandbox
- Check CloudWatch logs for errors
- For production, configure SES

### Testing Authentication

**Manual Test:**

```bash
# Start dev server
pnpm dev

# Visit http://localhost:3000
# Should redirect to /landing
# Click "Sign In"
# Should redirect to Cognito Hosted UI
# Sign in with test user
# Should redirect to /upload
```

**Check Session in Browser Console:**

```javascript
import { isAuthenticated, getCurrentUserInfo } from '@/lib/auth';

const authenticated = await isAuthenticated();
const userInfo = await getCurrentUserInfo();
console.log({ authenticated, userInfo });
```

---

## Additional Resources

- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [OAuth 2.0 with PKCE](https://oauth.net/2/pkce/)
- [Cognito Hosted UI Customization](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-ui-customization.html)
- [Cognito Security Best Practices](https://docs.aws.amazon.com/cognito/latest/developerguide/managing-security.html)

---

## Files Reference

```
apps/web/
├── lib/
│   ├── auth.ts                       # Core auth utilities
│   └── amplify-config.ts             # Amplify configuration
├── components/
│   ├── auth/
│   │   ├── AuthGuard.tsx             # Route protection
│   │   ├── SignInButton.tsx          # Sign in button
│   │   ├── SignOutButton.tsx         # Sign out button
│   │   └── SessionExpiredModal.tsx   # Session expiry modal
│   ├── navigation/
│   │   └── Sidebar.tsx               # Navigation sidebar
│   └── providers/
│       └── amplify-provider.tsx      # Amplify initialization
└── app/
    ├── page.tsx                      # Root redirect
    ├── (public)/
    │   ├── landing/page.tsx          # Landing page
    │   └── auth/callback/page.tsx    # OAuth callback
    └── (protected)/
        ├── layout.tsx                # Protected layout
        ├── upload/page.tsx           # Upload page
        └── vault/page.tsx            # Vault page
```

---

## Next Steps

1. **Backend Integration**: Add JWT validation in backend API
2. **User Profile**: Implement user profile page
3. **Error Handling**: Add toast notifications for auth errors
4. **Testing**: Write unit and E2E tests for auth flows
5. **Analytics**: Add analytics for auth events
6. **Social Sign-In**: Add Google, Apple, etc. (optional)
7. **Account Management**: Add password reset, email change, etc.
