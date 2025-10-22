# Pricing Fallback Changes

## Summary

Instead of throwing an error when no pricing data is available, the system now returns a graceful fallback with zeros and an informative message.

## Changes Made

### 1. **PricingResult Schema** (`packages/shared/src/schemas.ts`)

- Added optional `message` field to `PricingResultSchema`
- Made `windowDays` and `volatility` optional (not always available)

### 2. **Card Schema** (`packages/shared/src/schemas.ts`)

- Added optional `pricingMessage` field to `CardSchema`
- This field stores messages like "No pricing data available from any source"

### 3. **Pricing Orchestrator** (`services/backend/src/adapters/pricing-orchestrator.ts`)

- Changed behavior when `rawComps.length === 0`
- **Before**: Threw error `"No pricing data available from any source"`
- **After**: Returns fallback `PricingResult`:
  ```typescript
  {
    valueLow: 0,
    valueMedian: 0,
    valueHigh: 0,
    compsCount: 0,
    sources: [],
    confidence: 0,
    message: 'No pricing data available from any source'
  }
  ```
- Caches the fallback result to avoid repeated lookups

### 4. **Aggregator** (`services/backend/src/orchestration/aggregator.ts`)

- Saves `pricingResult.message` to `card.pricingMessage` if present
- Added `pricingMessage` to updateable fields in `upsertCardResults`

### 5. **Card Service** (`services/backend/src/store/card-service.ts`)

- Added `pricingMessage` to `CardItem` interface
- Added `pricingMessage` handling in `itemToCard` and `cardToItem` functions
- Added `pricingMessage` to updateable fields in `updateCard` function

## Result

### Before

- Card processing would fail with error
- Step Functions would retry or go to error handler
- Frontend would show generic error message
- Card would not be saved with any data

### After

- Card processing completes successfully
- Card is saved with pricing values set to 0
- `pricingMessage` field contains: "No pricing data available from any source"
- Frontend can display the message to users
- Users see their card with authenticity data, just no pricing

## Frontend Display

The frontend can now check for the `pricingMessage` field:

```typescript
if (card.pricingMessage) {
  // Show message: "No pricing data available from any source"
  // Display $0.00 for all pricing fields
} else {
  // Show normal pricing data
}
```

## Deployment

After deploying these changes, cards that previously failed due to missing pricing data will now:

1. Complete processing successfully
2. Show $0 for all pricing values
3. Display the message explaining why no pricing is available
4. Still show authenticity scores and other card data
