# Cognito 400 Bad Request Troubleshooting

## Issue

When navigating to protected pages, the app makes a POST request to `https://cognito-idp.us-east-1.amazonaws.com/` that returns 400 Bad Request with error: "Access Token does not have required scopes"

## Root Cause

The issue had two parts:

1. Amplify was trying to make Cognito API calls during server-side rendering (SSR) without proper configuration
2. The `fetchUserAttributes` API call requires the `aws.cognito.signin.user.admin` scope, which wasn't configured in the Cognito App Client

## Fixes Applied

1. **Updated `lib/amplify-config.ts`** - Only configure Amplify on the client side to avoid SSR issues
2. **Updated `lib/auth.ts`** - Use ID token claims instead of `fetchUserAttributes` API to get user info, avoiding the scope requirement

## Why This Works

In OAuth/OIDC, there are two types of tokens:

- **Access Token**: Used for API authorization (requires specific scopes)
- **ID Token**: Contains user identity claims (email, sub, etc.)

The `fetchUserAttributes` API requires the access token to have `aws.cognito.signin.user.admin` scope. Instead, we now read user info directly from the ID token payload, which always contains these claims and doesn't require additional API calls.

## Verification Steps

### 1. Restart the Dev Server

```bash
pnpm dev
```

### 2. Clear Browser Data

- Clear browser cache and cookies for localhost:3000
- Clear localStorage: Open DevTools → Application → Local Storage → Clear

### 3. Test the Fix

1. Navigate to a protected route (e.g., `/upload`, `/vault`, `/cards/123`)
2. Open browser DevTools (Network tab + Console)
3. You should NOT see:
   - 400 errors to `cognito-idp.us-east-1.amazonaws.com`
   - "Access Token does not have required scopes" errors
4. If unauthenticated, you should be redirected to `/landing`

### 4. Test Sign In Flow

1. Click "Sign In" button
2. Complete OAuth flow in Cognito Hosted UI
3. After redirect, you should be authenticated
4. Check console - no errors should appear

## Environment Variables

Ensure your `.env.local` has all required variables:

```bash
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_DmEHZd3WT
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=h0990960pig3qo42s6pmimrs1
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq-hackathon.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000/landing
NEXT_PUBLIC_API_BASE=https://22e7eyyxqe.execute-api.us-east-1.amazonaws.com
```

## Cognito Configuration (Optional)

While the fix works without changing Cognito, you can optionally add the required scope:

### Add aws.cognito.signin.user.admin Scope

1. Go to AWS Console → Cognito → User Pools → collectiq-hackathon
2. Navigate to App Integration → App clients
3. Select your app client
4. Under "Hosted UI settings" → "Advanced settings"
5. Add `aws.cognito.signin.user.admin` to allowed scopes
6. Save changes

**Note**: This is NOT required with the current fix, but may be useful if you need to use `fetchUserAttributes` in the future.

## Common Issues

### Issue: Still seeing 400 errors

**Solution:**

1. Restart the dev server
2. Hard refresh browser (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. Clear localStorage and cookies
4. Check that environment variables are correct

### Issue: Redirect loop

**Solution:**

1. Verify callback URLs in Cognito match exactly
2. Check browser console for specific errors
3. Ensure OAuth flow completes successfully

### Issue: "Invalid redirect URI" error

**Solution:**
Add both variants to Cognito allowed callback URLs:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback/`

## Technical Details

### What Changed in lib/auth.ts

**Before:**

```typescript
// Required API call with special scope
const attributes = await fetchUserAttributes();
return {
  sub: attributes.sub,
  email: attributes.email,
  // ...
};
```

**After:**

```typescript
// Read directly from ID token (no API call needed)
const session = await fetchAuthSession();
const idToken = session.tokens?.idToken;
const payload = idToken.payload;
return {
  sub: payload.sub,
  email: payload.email,
  // ...
};
```

### Benefits of This Approach

- ✅ No additional API calls (faster)
- ✅ No special scopes required
- ✅ Works with default Cognito configuration
- ✅ More reliable (fewer points of failure)

## Additional Debugging

If issues persist, check the ID token payload in browser console:

```javascript
import { fetchAuthSession } from 'aws-amplify/auth';

fetchAuthSession()
  .then((session) => {
    console.log('ID Token:', session.tokens?.idToken);
    console.log('Payload:', session.tokens?.idToken?.payload);
  })
  .catch((error) => {
    console.error('Session error:', error);
  });
```

The payload should contain:

- `sub`: User ID
- `email`: User email
- `email_verified`: Email verification status
- `exp`: Token expiration
