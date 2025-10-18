# Architecture Change: Cognito Hosted UI Implementation

## Summary

The authentication specification has been updated to use **AWS Amplify** for Cognito Hosted UI integration instead of custom Next.js API routes. This aligns with AWS best practices and the existing backend architecture.

## Why This Change?

### Current Implementation Issues

1. **Unnecessary API Routes**: The `/api/auth/*` routes duplicate functionality that Amplify provides
2. **Token Storage Mismatch**: Frontend stores tokens in cookies, but backend expects them in Authorization headers
3. **Extra Network Hop**: Client → Next.js API → Backend instead of Client → Backend
4. **Maintenance Burden**: Custom PKCE, state management, and token refresh logic

### Backend Reality

Your backend (`services/backend`) is **already correctly configured** for standard Cognito Hosted UI:

```typescript
// Backend expects JWT in Authorization header
function extractJwtClaims(event: APIGatewayProxyEventV2WithJWT): AuthContext {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  // Extracts sub, email, username from validated JWT
}
```

- ✅ API Gateway has JWT authorizer
- ✅ Validates Cognito access tokens
- ✅ Extracts claims automatically
- ✅ Passes claims to Lambda functions

## New Architecture

### Flow Diagram

```
User → Amplify.signIn() → Cognito Hosted UI → Amplify (token exchange)
  → Frontend (get token) → API Gateway (validate JWT) → Lambda (use claims)
```

### Key Components

1. **AWS Amplify**: Handles OAuth flow, PKCE, token management
2. **Frontend**: Gets tokens from Amplify, sends to backend
3. **API Gateway**: Validates JWT, extracts claims
4. **Lambda**: Reads claims from event context

## What's Changing

### Removed

- ❌ `/api/auth/callback/route.ts` - Amplify handles token exchange
- ❌ `/api/auth/session/route.ts` - Amplify manages session
- ❌ `/api/auth/refresh/route.ts` - Amplify auto-refreshes tokens
- ❌ `/api/auth/signout/route.ts` - Amplify handles sign-out
- ❌ Custom PKCE implementation - Amplify handles this
- ❌ HTTP-only cookies - Amplify uses secure storage
- ❌ Manual token refresh logic - Amplify does this automatically

### Added

- ✅ `lib/amplify-config.ts` - Configure Amplify
- ✅ Updated `lib/auth.ts` - Wrapper around Amplify functions
- ✅ `lib/api.ts` - API client with Authorization headers
- ✅ Simplified components - Less code, same functionality

### Updated

- 🔄 `AuthGuard` - Use Amplify's `fetchAuthSession`
- 🔄 `SignInButton` - Use Amplify's `signInWithRedirect`
- 🔄 `SignOutButton` - Use Amplify's `signOut`
- 🔄 Environment variables - Add `NEXT_PUBLIC_AWS_REGION`

## Benefits

### For Development

- **Less Code**: Remove ~500 lines of custom auth code
- **Easier Maintenance**: AWS maintains Amplify
- **Better Testing**: Mock Amplify functions instead of complex flows
- **Standard Pattern**: Follows AWS documentation

### For Security

- **Proven Implementation**: Amplify is battle-tested
- **Automatic Updates**: Security patches from AWS
- **Best Practices**: PKCE, state management handled correctly
- **Token Security**: Secure storage mechanisms

### For Performance

- **Fewer Network Hops**: Direct client-to-backend communication
- **Automatic Refresh**: Transparent token refresh
- **Better Caching**: Amplify optimizes token storage
- **Smaller Bundle**: Remove custom auth code

## Migration Path

### Step 1: Install Amplify

```bash
cd apps/web
pnpm add aws-amplify
```

### Step 2: Configure Amplify

```typescript
// lib/amplify-config.ts
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID!,
      loginWith: {
        oauth: {
          domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN!,
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI!],
          redirectSignOut: [process.env.NEXT_PUBLIC_OAUTH_LOGOUT_URI!],
          responseType: 'code',
        },
      },
    },
  },
});
```

### Step 3: Update Auth Functions

```typescript
// lib/auth.ts
import { signInWithRedirect, signOut, fetchAuthSession } from 'aws-amplify/auth';

export async function signIn() {
  await signInWithRedirect({ provider: 'Cognito' });
}

export async function getAccessToken() {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken.toString();
}
```

### Step 4: Update API Client

```typescript
// lib/api.ts
export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const accessToken = await getAccessToken();

  return fetch(`${process.env.NEXT_PUBLIC_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
```

### Step 5: Remove Old Code

- Delete `/api/auth/*` routes
- Delete OAuth callback page
- Remove PKCE functions
- Remove cookie management

## Testing Strategy

### Unit Tests

- Mock Amplify functions
- Test auth utility wrappers
- Test API client Authorization header
- Test component state transitions

### Integration Tests

- Mock Amplify OAuth flow
- Test token retrieval
- Test API requests with tokens
- Test error handling

### E2E Tests

- Use test Cognito user
- Complete full auth flow
- Verify backend receives JWT
- Test sign-out

## Rollout Plan

### Phase 1: Development

1. Implement Amplify integration
2. Test locally with dev Cognito pool
3. Verify backend integration

### Phase 2: Testing

1. Deploy to test environment
2. Run E2E tests
3. Verify all flows work

### Phase 3: Production

1. Deploy to production
2. Monitor authentication metrics
3. Users will need to sign in again (expected)

## FAQ

### Q: Why not keep the current implementation?

**A:** The current implementation doesn't match the backend architecture. The backend expects JWT in Authorization headers, not cookies. The Next.js API routes add unnecessary complexity and latency.

### Q: Is Amplify required?

**A:** No, but it's the recommended approach. You could implement direct Cognito OAuth flow manually, but you'd still need to remove the Next.js API routes and send tokens in Authorization headers.

### Q: What about token security?

**A:** Amplify uses secure browser storage mechanisms. While not HTTP-only cookies, it's the standard approach for SPAs and is secure when combined with HTTPS and proper CSP headers.

### Q: Will users need to sign in again?

**A:** Yes, after deployment users will need to sign in again. This is a one-time inconvenience for a better architecture.

### Q: What about the middleware?

**A:** The middleware can be simplified or removed since Amplify handles authentication. The AuthGuard component provides sufficient protection.

## References

- [AWS Amplify Documentation](https://docs.amplify.aws/javascript/)
- [Cognito Hosted UI Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-app-integration.html)
- [API Gateway JWT Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [Your Backend Implementation](../../services/backend/src/auth/jwt-claims.ts)

## Next Steps

1. Review the updated spec files:
   - `requirements.md` - Updated acceptance criteria
   - `design.md` - New architecture design
   - `tasks.md` - Implementation tasks

2. Start implementation:
   - Begin with Task 1: Install and configure AWS Amplify
   - Follow tasks sequentially
   - Test after each major change

3. Questions or concerns?
   - Review this document
   - Check AWS Amplify documentation
   - Consult with team
