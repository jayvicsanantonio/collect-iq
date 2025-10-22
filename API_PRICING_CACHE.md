# API-Level Pricing Cache Implementation

## Overview

The Pokémon TCG API adapter now implements cross-user caching based on card identifiers (name + set). This means when any user uploads a card, subsequent uploads of the same card by any user will use cached data instead of making redundant API calls.

## Cache Strategy

### API-Level Cache (Cross-User)

- **Cache Key**: `cardName|set` (normalized to lowercase)
- **Storage**: DynamoDB with partition key `API_CACHE`
- **TTL**: 1 hour (3600 seconds)
- **Scope**: Shared across all users

### Cache Flow

1. **Cache Check**: Before calling Pokémon TCG API, check if data exists in cache
2. **Cache Hit**: Return cached raw comps immediately (no API call)
3. **Cache Miss**: Fetch from API
4. **Only Cache Success**: Only cache when:
   - API call succeeds (no errors thrown)
   - Cards are found (cards.length > 0)
   - Pricing data is extracted (allComps.length > 0)
   - Card name exists in query
5. **Never Cache**: Empty results, errors, or failed API calls

## Benefits

- **Massive API Call Reduction**: Popular cards only fetched once per hour across all users
- **Cost Optimization**: Reduces both API costs and DynamoDB read/write costs
- **Faster Response Times**: Cache hits return instantly without network latency
- **Scalability**: System can handle many users uploading the same popular cards

## Example Scenario

```
User A uploads Charizard from Base Set
  → Cache miss → API call → Save to cache

User B uploads same Charizard 10 minutes later
  → Cache hit → No API call → Instant response

User C uploads same Charizard 30 minutes later
  → Cache hit → No API call → Instant response

After 1 hour, cache expires
User D uploads same Charizard
  → Cache miss → API call → Refresh cache
```

## Cache TTL

- **Default**: 3600 seconds (1 hour)
- **Rationale**: Pokémon TCG market prices don't change frequently
- **Auto-Expiration**: DynamoDB TTL automatically removes expired items

## Implementation Details

### PokemonTCGAdapter

```typescript
protected async fetchCompsInternal(query: PriceQuery): Promise<RawComp[]> {
  // Check cache first
  if (query.cardName) {
    const cachedComps = await getAPIPricingCache(query.cardName, query.set);
    if (cachedComps) {
      return cachedComps; // Cache hit - no API call
    }
  }

  try {
    // Cache miss - fetch from API
    const cards = await this.searchCards(query);

    if (cards.length === 0) {
      return []; // Don't cache empty results
    }

    const allComps = this.extractComps(cards);

    // Only cache successful results with data
    if (query.cardName && allComps.length > 0) {
      await saveAPIPricingCache(query.cardName, query.set, allComps);
    }

    return allComps;
  } catch (error) {
    // Don't cache errors - let them propagate
    throw error;
  }
}
```

### DynamoDB Schema

```typescript
{
  PK: 'API_CACHE',                    // Global partition key
  SK: 'PRICE#charizard|base set',     // Card identifier
  entityType: 'API_PRICE_CACHE',
  cacheKey: 'charizard|base set',
  rawComps: [...],                    // Cached pricing data
  createdAt: '2025-10-22T...',
  ttl: 1729612800                     // Unix timestamp for expiration
}
```

## Logging

Cache operations are logged for observability:

- `Pokémon TCG API cache hit` - Data served from cache
- `Pokémon TCG API cache miss, fetching from API` - API call required
- `Cached successful API result` - New data cached
- `No Pokémon TCG cards found, not caching empty result` - Empty result not cached
- `No pricing data found, not caching empty result` - No comps extracted, not cached
- `Pokémon TCG API error, not caching` - Error occurred, not cached

## Related Files

- `services/backend/src/adapters/pokemontcg-adapter.ts` - Cache integration
- `services/backend/src/store/api-pricing-cache.ts` - Cache service implementation
- `services/backend/src/store/index.ts` - Cache exports
