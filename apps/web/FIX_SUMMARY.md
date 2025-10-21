# Cognito Authentication Fix Summary

## Problem

POST requests to `cognito-idp.us-east-1.amazonaws.com` were returning 400 Bad Request with error:

```
NotAuthorizedException: Access Token does not have required scopes
```

## Root Cause

The `fetchUserAttributes()` API requires the access token to have the `aws.cognito.signin.user.admin` scope, which wasn't configured in your Cognito App Client.

## Solution

Instead of calling the `fetchUserAttributes()` API, we now read user information directly from the **ID token payload**. This is:

- ✅ Faster (no API call)
- ✅ More reliable (no scope requirements)
- ✅ Standard OIDC practice

## Files Changed

### 1. `lib/amplify-config.ts`

- Added client-side only check to prevent SSR issues

### 2. `lib/auth.ts`

- Removed `fetchUserAttributes` import
- Updated `getCurrentUserInfo()` to read from ID token
- Updated `getSession()` to read from ID token
- Added error logging to all functions

## Next Steps

1. **Restart your dev server:**

   ```bash
   pnpm dev
   ```

2. **Clear browser data:**

   - Clear cache and cookies for localhost:3000
   - Clear localStorage in DevTools

3. **Test:**
   - Navigate to `/upload`, `/vault`, or `/cards/123`
   - You should no longer see 400 errors
   - Sign in flow should work correctly

## Expected Behavior

✅ No 400 errors to Cognito API
✅ No "Access Token does not have required scopes" errors
✅ User info correctly retrieved from ID token
✅ Authentication checks work properly

See `COGNITO_TROUBLESHOOTING.md` for detailed troubleshooting steps.
