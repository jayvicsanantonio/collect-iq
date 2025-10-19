# Pricing Adapters

This module implements the pricing adapter system for CollectIQ, providing real-time market valuation from multiple sources.

## Architecture

The pricing system follows a layered architecture:

1. **Base Adapter** - Provides circuit breaker, rate limiting, and retry logic
2. **Source Adapters** - Implement specific API integrations (eBay, TCGPlayer, PriceCharting)
3. **Pricing Service** - Normalizes and fuses data from multiple sources
4. **Orchestrator** - Coordinates parallel fetching and caching

## Components

### BasePriceAdapter

Abstract base class that all pricing adapters extend. Provides:

- **Circuit Breaker**: Opens after 5 consecutive failures, closes after 60 seconds
- **Rate Limiting**: Configurable requests per minute with sliding window
- **Exponential Backoff**: Retries failed requests up to 3 times with increasing delays
- **Availability Checking**: `isAvailable()` method for health checks

### EbayAdapter

Integrates with eBay Finding API to fetch completed sales data.

- **API**: eBay Finding Service v1.0
- **Rate Limit**: 20 requests/minute
- **Features**:
  - Searches Pokémon TCG category (183454)
  - Fetches up to 3 pages of results (300 items)
  - Filters for sold items only
  - Maps eBay conditions to standard scale
  - Supports date range filtering

**Configuration**: Requires `EBAY_APP_ID` secret in AWS Secrets Manager

### TCGPlayerAdapter

Integrates with TCGPlayer API for market pricing data.

- **API**: TCGPlayer Catalog & Pricing API
- **Rate Limit**: 30 requests/minute
- **Features**:
  - OAuth 2.0 client credentials authentication
  - Product search with fuzzy matching
  - Market price, low, mid, and high price points
  - Condition-specific pricing
  - Automatic token refresh

**Configuration**: Requires `TCGPLAYER_CREDENTIALS` secret (JSON with publicKey and privateKey)

### PriceChartingAdapter

Integrates with PriceCharting API for historical pricing trends.

- **API**: PriceCharting REST API
- **Rate Limit**: 10 requests/minute (conservative)
- **Features**:
  - Product search with set and number matching
  - Historical pricing data within date window
  - Multiple condition types (loose, CIB, new, graded)
  - Time-series data for trend analysis

**Configuration**: Requires `PRICECHARTING_KEY` secret in AWS Secrets Manager

### PricingService

Handles data normalization and fusion logic.

**Normalization**:

- Standardizes conditions to: Poor, Good, Excellent, Near Mint, Mint
- Converts all prices to USD using exchange rates
- Validates and filters invalid data points

**Outlier Removal**:

- Uses Interquartile Range (IQR) method
- Removes prices outside 1.5 × IQR from Q1/Q3
- Requires minimum 4 data points

**Fusion**:

- Computes percentiles: 10th (valueLow), 50th (valueMedian), 90th (valueHigh)
- Calculates confidence score based on sample size and variance
- Computes volatility (coefficient of variation)

### PricingOrchestrator

Coordinates the entire pricing pipeline.

**Features**:

- Parallel fetching from all available sources
- Automatic cache checking (5-minute TTL)
- Graceful degradation if sources fail
- DynamoDB caching with automatic expiration
- Source availability monitoring

**Usage**:

```typescript
import { getPricingOrchestrator } from './adapters/index.js';

const orchestrator = getPricingOrchestrator();
const result = await orchestrator.fetchAllComps(
  {
    cardName: 'Charizard',
    set: 'Base Set',
    number: '4',
    condition: 'Near Mint',
    windowDays: 14,
  },
  userId,
  cardId,
);
```

## Data Flow

```
Query → Orchestrator
  ├─→ Check Cache (DynamoDB)
  │   └─→ Return if valid
  │
  ├─→ Check Source Availability
  │   ├─→ eBay (circuit breaker check)
  │   ├─→ TCGPlayer (circuit breaker check)
  │   └─→ PriceCharting (circuit breaker check)
  │
  ├─→ Fetch in Parallel
  │   ├─→ eBay.fetchComps()
  │   ├─→ TCGPlayer.fetchComps()
  │   └─→ PriceCharting.fetchComps()
  │
  ├─→ Normalize (PricingService)
  │   ├─→ Standardize conditions
  │   ├─→ Convert to USD
  │   └─→ Validate data
  │
  ├─→ Remove Outliers (IQR)
  │
  ├─→ Fuse Results
  │   ├─→ Compute percentiles
  │   ├─→ Calculate confidence
  │   └─→ Calculate volatility
  │
  └─→ Cache Result (DynamoDB, 5min TTL)
```

## Error Handling

All adapters implement robust error handling:

1. **Network Errors**: Retry with exponential backoff (3 attempts)
2. **Rate Limits**: Automatic waiting with sliding window
3. **Circuit Breaker**: Prevents cascading failures
4. **Graceful Degradation**: Continue with available sources
5. **Logging**: Structured logs for debugging

## Testing

To test the pricing adapters:

```bash
# Run unit tests
pnpm test src/adapters

# Run with coverage
pnpm test:coverage src/adapters
```

## Environment Variables

- `CACHE_TTL_SECONDS`: Cache duration (default: 300)
- `AWS_REGION`: AWS region for Secrets Manager
- `DDB_TABLE`: DynamoDB table name for caching

## Secrets Configuration

Store API credentials in AWS Secrets Manager:

```bash
# eBay
aws secretsmanager create-secret \
  --name EBAY_APP_ID \
  --secret-string "your-app-id"

# TCGPlayer
aws secretsmanager create-secret \
  --name TCGPLAYER_CREDENTIALS \
  --secret-string '{"publicKey":"xxx","privateKey":"yyy"}'

# PriceCharting
aws secretsmanager create-secret \
  --name PRICECHARTING_KEY \
  --secret-string "your-api-key"
```

## Performance Considerations

- **Parallel Execution**: All sources fetched simultaneously
- **Caching**: 5-minute TTL reduces API calls by ~95%
- **Rate Limiting**: Prevents API quota exhaustion
- **Circuit Breaker**: Fails fast when sources are down
- **Lambda Reuse**: Singleton orchestrator instance across invocations

## Future Enhancements

1. **Additional Sources**: CardMarket, StockX, Mercari
2. **Machine Learning**: Predictive pricing models
3. **Real-time Updates**: WebSocket subscriptions
4. **Historical Trends**: Time-series analysis
5. **Grading Integration**: PSA/CGC grade-specific pricing
