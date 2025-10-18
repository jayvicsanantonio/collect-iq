# CollectIQ Frontend Library

This directory contains core utilities and helpers for the CollectIQ frontend application.

## Files

### `api.ts`

Typed API client for communicating with the CollectIQ backend.

**Features:**
- Automatic credential inclusion (cookies for JWT authentication)
- RFC 7807 ProblemDetails error parsing
- Exponential backoff retry logic for GET requests (3 attempts: 1s, 2s, 4s)
- Request ID tracking for traceability
- Zod schema validation for all responses
- Type-safe API methods

**API Methods:**
- `getPresignedUrl(params)` - Get presigned URL for S3 upload
- `createCard(data)` - Create a new card
- `getCards(params?)` - Get paginated list of cards
- `getCard(cardId)` - Get a single card by ID
- `deleteCard(cardId)` - Delete a card
- `refreshValuation(cardId, forceRefresh?)` - Refresh card valuation

**Usage:**
```typescript
import { api, ApiError } from '@/lib/api';

try {
  const cards = await api.getCards({ limit: 20 });
  console.log(cards.items);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(error.problem.detail);
  }
}
```

### `swr.ts`

SWR configuration and custom hooks for data fetching with stale-while-revalidate caching.

**Features:**
- Global SWR configuration with optimized settings
- Specialized cache configurations for different data types (vault lists, card details, valuations)
- Custom hooks for common queries (`useCards`, `useCard`)
- Mutation hooks with optimistic updates (`useDeleteCard`, `useRefreshValuation`)
- Cache key generators for consistent caching
- Cache invalidation helpers
- Automatic background revalidation

**Cache TTL Configuration:**
- Vault lists: 5 minutes (frequently updated)
- Card details: 10 minutes (less frequently updated)
- Valuation data: 1 hour (expensive to compute)
- User session: 15 minutes (security-sensitive)

**Usage:**
```typescript
import { useCards, useCard, useDeleteCard } from '@/lib/swr';

function VaultPage() {
  const { data, error, isLoading } = useCards({ limit: 20 });
  const { trigger: deleteCard } = useDeleteCard();

  // ... component logic
}
```

### `cache-headers.ts`

HTTP cache header utilities for API routes.

**Features:**
- Standard cache presets (NO_CACHE, SHORT_CACHE, MEDIUM_CACHE, LONG_CACHE, STATIC_CACHE)
- Cache-Control header generation
- Stale-while-revalidate support
- Next.js route handler helpers
- Cache validation utilities

**Cache Presets:**
- `NO_CACHE` - No caching (auth endpoints, mutations)
- `SHORT_CACHE` - 1 minute max-age, 5 minutes stale-while-revalidate (vault lists)
- `MEDIUM_CACHE` - 5 minutes max-age, 10 minutes stale-while-revalidate (card details)
- `LONG_CACHE` - 1 hour max-age, 2 hours stale-while-revalidate (valuations)
- `STATIC_CACHE` - 1 year max-age (static assets)

**Usage:**
```typescript
import { jsonWithCache, CACHE_PRESETS } from '@/lib/cache-headers';

export async function GET() {
  const data = await fetchData();
  return jsonWithCache(data, CACHE_PRESETS.MEDIUM_CACHE);
}
```

### `auth.ts`

Authentication utilities for Cognito Hosted UI integration.

### `env.ts`

Environment variable validation and configuration.

### `utils.ts`

General utility functions (e.g., `cn()` for Tailwind class merging).

## Shared Package Integration

The API client imports types and schemas from `@collectiq/shared`:

- `Card`, `CardSchema` - Card data structure
- `ValuationData`, `ValuationDataSchema` - Valuation information
- `AuthenticityDetails`, `AuthenticityDetailsSchema` - Authenticity analysis
- `ProblemDetails`, `ProblemDetailsSchema` - RFC 7807 error format
- `PresignRequest`, `PresignResponse` - S3 upload presigning
- `CreateCardRequest` - Card creation payload
- `ListCardsResponse` - Paginated card list

This ensures type consistency between frontend and backend.

## Error Handling

All API errors follow RFC 7807 ProblemDetails format:

```typescript
interface ProblemDetails {
  type: string;        // URI reference identifying the problem type
  title: string;       // Short, human-readable summary
  status: number;      // HTTP status code
  detail: string;      // Human-readable explanation
  instance?: string;   // URI reference to specific occurrence
  requestId?: string;  // Request ID for traceability
}
```

Common error status codes:
- `401` - Unauthorized (session expired)
- `403` - Forbidden (no access to resource)
- `404` - Not Found
- `413` - Payload Too Large (image > 12 MB)
- `415` - Unsupported Media Type
- `429` - Too Many Requests (rate limited)
- `5xx` - Server errors (automatically retried)

## SWR Configuration

Default SWR settings:
- `revalidateOnFocus: false` - Don't revalidate when window regains focus
- `revalidateOnReconnect: true` - Revalidate when network reconnects
- `revalidateIfStale: true` - Revalidate if data is stale
- `dedupingInterval: 2000` - Dedupe requests within 2 seconds
- `focusThrottleInterval: 5000` - Throttle focus revalidation to 5 seconds
- `errorRetryCount: 3` - Retry failed requests up to 3 times
- `errorRetryInterval: 5000` - Wait 5 seconds between retries
- `keepPreviousData: true` - Keep previous data while fetching new data

## Cache Strategy

**Stale-While-Revalidate:**
The application implements aggressive stale-while-revalidate caching:
1. Serve cached data immediately (stale)
2. Revalidate in background
3. Update UI when fresh data arrives

**User-scoped caching:**
- All card data is scoped to the authenticated user
- Cache keys include user context implicitly via JWT cookies

**Cache invalidation:**
- Mutations automatically revalidate affected cache entries
- Manual invalidation helpers available for complex scenarios
- Optimistic updates for immediate UI feedback

**Example cache keys:**
- `/cards` - All cards for current user
- `/cards?limit=20&cursor=abc123` - Paginated cards
- `/cards/{cardId}` - Single card detail

**Cache invalidation helpers:**
```typescript
import { invalidateCardsCache, invalidateCardCache, updateCardInCache } from '@/lib/swr';
import { useSWRConfig } from 'swr';

function MyComponent() {
  const { mutate } = useSWRConfig();
  
  // Invalidate all cards caches
  invalidateCardsCache(mutate);
  
  // Invalidate specific card
  invalidateCardCache(mutate, cardId);
  
  // Optimistically update card
  updateCardInCache(mutate, cardId, (card) => ({
    ...card,
    valueMedian: newValue,
  }));
}
```

For detailed caching documentation, see [CACHING_STRATEGY.md](../CACHING_STRATEGY.md).
