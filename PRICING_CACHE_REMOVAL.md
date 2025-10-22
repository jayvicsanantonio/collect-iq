# Pricing Cache Removal

## Summary

Removed caching logic from the Pricing Agent to ensure fresh pricing data on every request.

## Changes Made

### 1. Updated `pricing-orchestrator.ts`

- Removed import of `savePricingSnapshot` and `getPricingSnapshot`
- Removed `userId`, `cardId`, and `forceRefresh` parameters from `fetchAllComps()`
- Removed cache check before fetching pricing data
- Removed cache storage after fetching pricing data
- Removed `getCachedResult()` and `cacheResult()` private methods
- Simplified method signature to only accept `PriceQuery`

### 2. Updated `pricing-agent.ts`

- Removed `forceRefresh` parameter from `PricingAgentInput` interface
- Removed `forceRefresh` from event destructuring
- Updated `orchestrator.fetchAllComps()` call to only pass query object
- Removed `forceRefresh` from logging

## Files Modified

- `services/backend/src/adapters/pricing-orchestrator.ts`
- `services/backend/src/agents/pricing-agent.ts`

## Files Not Modified (Still Exist But Unused)

- `services/backend/src/store/pricing-cache.ts` - Cache implementation still exists but is no longer called
- `services/backend/src/store/index.ts` - Still exports cache functions but they're not imported anywhere

## Behavior Changes

**Before:**

- First request: Fetches from pricing sources, caches result for 5 minutes (default TTL)
- Subsequent requests (within TTL): Returns cached result
- `forceRefresh=true`: Bypasses cache and fetches fresh data

**After:**

- Every request: Fetches fresh pricing data from sources
- No caching layer
- Always returns real-time pricing data

## Benefits

- Ensures users always see the most current pricing data
- Eliminates cache invalidation complexity
- Reduces DynamoDB read/write operations
- Simplifies code and reduces potential cache-related bugs

## Trade-offs

- Slightly higher latency per request (no cache hits)
- More API calls to pricing sources (PokemonTCG API, etc.)
- Higher Lambda execution time

## Deployment

No infrastructure changes required. Simply rebuild and redeploy the Lambda functions:

```bash
cd services/backend
pnpm build
# Deploy via your CI/CD or manual Lambda update
```

## Optional Cleanup

If you want to remove the unused cache code entirely:

1. Delete `services/backend/src/store/pricing-cache.ts`
2. Remove exports from `services/backend/src/store/index.ts`:
   ```typescript
   // Remove these lines:
   export {
     savePricingSnapshot,
     getPricingSnapshot,
     deletePricingSnapshots,
   } from './pricing-cache.js';
   ```
