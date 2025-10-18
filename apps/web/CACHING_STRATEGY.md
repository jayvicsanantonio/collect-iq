# Caching Strategy

This document describes the comprehensive caching strategy implemented in CollectIQ frontend.

## Overview

CollectIQ uses a multi-layered caching approach combining:

1. **SWR (stale-while-revalidate)** for client-side data caching
2. **HTTP Cache-Control headers** for browser and CDN caching
3. **Optimistic UI updates** for instant feedback on mutations

## SWR Configuration

### Cache Time-to-Live (TTL)

Different data types have different cache lifetimes based on update frequency:

| Data Type      | Cache TTL  | Revalidation      | Use Case                      |
| -------------- | ---------- | ----------------- | ----------------------------- |
| Vault List     | 5 minutes  | Background        | Frequently updated collection |
| Card Details   | 10 minutes | Background        | Less frequently updated       |
| Valuation Data | 1 hour     | On mount disabled | Expensive to compute          |
| Session Data   | 15 minutes | On focus disabled | Security-sensitive            |

### Stale-While-Revalidate Strategy

The application implements aggressive stale-while-revalidate:

```typescript
// Example: Vault list configuration
{
  dedupingInterval: 5000,        // Dedupe requests within 5 seconds
  revalidateOnMount: true,       // Always revalidate on mount
  refreshInterval: 300000,       // Auto-refresh every 5 minutes
  keepPreviousData: true,        // Keep previous data while fetching
}
```

**Benefits:**

- Instant UI updates (serve cached data immediately)
- Fresh data in background (revalidate without blocking UI)
- Reduced API calls (deduplication and smart revalidation)

## HTTP Cache Headers

### Cache Presets

The application defines standard cache presets for different scenarios:

#### NO_CACHE (Authentication endpoints)

```
Cache-Control: no-store, no-cache
```

- Used for: `/api/auth/*` endpoints
- Prevents caching of sensitive authentication data

#### SHORT_CACHE (Vault lists)

```
Cache-Control: private, max-age=60, stale-while-revalidate=300
```

- Used for: Card lists, frequently updated data
- 1-minute fresh, 5-minute stale window

#### MEDIUM_CACHE (Card details)

```
Cache-Control: private, max-age=300, stale-while-revalidate=600
```

- Used for: Individual card data
- 5-minute fresh, 10-minute stale window

#### LONG_CACHE (Valuation data)

```
Cache-Control: private, max-age=3600, stale-while-revalidate=7200
```

- Used for: Expensive computations
- 1-hour fresh, 2-hour stale window

#### STATIC_CACHE (Assets)

```
Cache-Control: public, max-age=31536000
```

- Used for: Images, fonts, static files
- 1-year cache for immutable assets

## Cache Invalidation

### Mutation-Based Invalidation

When data is mutated, related caches are automatically invalidated:

#### Delete Card

```typescript
// Invalidates:
// - /cards (list cache)
// - /cards/{id} (specific card cache)
// - /cards?* (all paginated lists)
```

#### Refresh Valuation

```typescript
// Invalidates:
// - /cards/{id} (specific card cache)
// - /cards (list cache to show updated values)
```

### Cache Key Strategy

Cache keys are structured for efficient invalidation:

```typescript
// List keys
'/cards'; // Base list
'/cards?cursor=abc&limit=20'; // Paginated list

// Detail keys
'/cards/{cardId}'; // Specific card

// Invalidation patterns
key.startsWith('/cards'); // Invalidate all card-related caches
```

## Optimistic UI Updates

### Delete Card Flow

1. **Optimistic Update**: Remove card from UI immediately
2. **API Call**: Send delete request to backend
3. **Success**: Keep optimistic update, invalidate caches
4. **Error**: Rollback optimistic update, show error

```typescript
// Optimistic removal
setCards((prev) => prev.filter((c) => c.cardId !== deleteCardId));

try {
  await api.deleteCard(deleteCardId);
  // Success - cache invalidation happens automatically
} catch (error) {
  // Rollback
  setCards(previousCards);
}
```

### Refresh Valuation Flow

1. **Show Loading**: Display loading state on card
2. **API Call**: Trigger valuation refresh
3. **Background Revalidation**: SWR fetches fresh data
4. **UI Update**: Card updates with new valuation

## Performance Optimizations

### Deduplication

Multiple components requesting the same data within the deduplication interval share a single request:

```typescript
// Component A requests /cards
useCards();

// Component B requests /cards within 5 seconds
useCards(); // Uses same request, no duplicate API call
```

### Request Coalescing

SWR automatically coalesces multiple requests for the same key:

```typescript
// Multiple rapid calls
getCard('123');
getCard('123');
getCard('123');
// Results in single API call
```

### Background Revalidation

Data is revalidated in the background without blocking the UI:

```typescript
// User sees cached data immediately
const { data } = useCard(cardId);

// Fresh data fetched in background
// UI updates when new data arrives
```

## Cache Monitoring

### Development Mode

In development, cache updates are logged to the console:

```typescript
onSuccess: (data, key) => {
  if (process.env.NODE_ENV === 'development') {
    console.debug('SWR Cache Updated:', { key });
  }
};
```

### Cache Inspection

Use SWR DevTools (optional) to inspect cache state:

```bash
npm install @swr-devtools/react-panel
```

## Best Practices

### DO

✅ Use SWR hooks for data fetching
✅ Implement optimistic updates for mutations
✅ Set appropriate cache TTLs based on data volatility
✅ Invalidate related caches after mutations
✅ Use HTTP cache headers for API routes

### DON'T

❌ Store sensitive data in long-lived caches
❌ Cache authentication endpoints
❌ Forget to invalidate caches after mutations
❌ Use overly aggressive revalidation (impacts performance)
❌ Cache user-specific data with `public` directive

## Testing Cache Behavior

### Manual Testing

1. **Stale-While-Revalidate**:
   - Load vault page
   - Note data displayed
   - Wait for background revalidation
   - Verify data updates without loading state

2. **Optimistic Updates**:
   - Delete a card
   - Verify immediate removal from UI
   - Check network tab for API call
   - Verify rollback on error (simulate by blocking API)

3. **Cache Invalidation**:
   - Refresh valuation on card
   - Verify vault list updates with new value
   - Check card detail page updates

### Automated Testing

```typescript
// Test cache invalidation
it('invalidates cache after delete', async () => {
  const { mutate } = useSWRConfig();

  // Delete card
  await deleteCard('123');

  // Verify cache invalidation
  expect(mutate).toHaveBeenCalledWith(expect.any(Function), undefined, {
    revalidate: true,
  });
});
```

## Future Enhancements

### Planned Improvements

1. **Service Worker Caching**: Offline support with background sync
2. **IndexedDB Storage**: Persistent cache across sessions
3. **Cache Warming**: Preload frequently accessed data
4. **Smart Prefetching**: Predict and prefetch next page
5. **Cache Compression**: Reduce memory footprint for large datasets

### Monitoring

1. **Cache Hit Rate**: Track percentage of requests served from cache
2. **Revalidation Frequency**: Monitor background revalidation patterns
3. **Cache Size**: Track memory usage of cached data
4. **Stale Data Duration**: Measure how long users see stale data

## References

- [SWR Documentation](https://swr.vercel.app/)
- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [Stale-While-Revalidate RFC](https://tools.ietf.org/html/rfc5861)
- [Next.js Caching](https://nextjs.org/docs/app/building-your-application/caching)
