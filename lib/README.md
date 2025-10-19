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

SWR configuration and custom hooks for data fetching.

**Features:**
- Global SWR configuration with optimized settings
- Custom hooks for common queries (`useCards`, `useCard`)
- Mutation hooks with optimistic updates (`useDeleteCard`, `useRefreshValuation`)
- Cache key generators for consistent caching
- Cache invalidation helpers

**Usage:**
```typescript
import { useCards, useCard, useDeleteCard } from '@/lib/swr';

function VaultPage() {
  const { data, error, isLoading } = useCards({ limit: 20 });
  const { trigger: deleteCard } = useDeleteCard();

  // ... component logic
}
```

### `auth.ts`

Authentication utilities for Cognito Hosted UI integration.

### `env.ts`

Environment variable validation and configuration.

### `utils.ts`

General utility functions (e.g., `cn()` for Tailwind class merging).

## Shared Types

The API client and UI components share a single set of Zod schemas and types from `@/lib/types`:

- `Card`, `CardSchema` - Card data structure
- `AuthenticityDetails`, `AuthenticityDetailsSchema` - Authenticity analysis
- `Candidate`, `CandidateSchema` - Identification candidates
- `ProblemDetails`, `ProblemDetailsSchema` - RFC 7807 error format
- `PresignRequest`, `PresignResponse` - S3 upload presigning
- `CreateCardRequest` - Card creation payload
- `ListCardsResponse` - Paginated card list
- `RevalueRequest`, `RevalueResponse` - Valuation refresh operations

This keeps the frontend self-contained while maintaining strong typing across the app.

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
- `dedupingInterval: 2000` - Dedupe requests within 2 seconds
- `focusThrottleInterval: 5000` - Throttle focus revalidation to 5 seconds
- `errorRetryCount: 3` - Retry failed requests up to 3 times
- `errorRetryInterval: 5000` - Wait 5 seconds between retries

## Cache Strategy

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
