# Pricing Agent: Complete Technical Documentation

## Executive Summary

The Pricing Agent is a sophisticated multi-source pricing aggregation system that determines the fair market value of Pokémon Trading Cards. It combines real-time market data from multiple sources, statistical analysis, outlier detection, and AI-powered valuation insights to provide accurate, explainable pricing with confidence scores.

**Key Capabilities:**

- Multi-source pricing aggregation (Pokémon TCG API, with extensibility for eBay, TCGPlayer, PriceCharting)
- Statistical outlier removal using Interquartile Range (IQR) method
- Currency normalization and condition standardization
- Circuit breaker pattern for fault tolerance
- Rate limiting for API compliance
- AI-powered valuation summary using Amazon Bedrock (Claude 4.0 Sonnet)
- Graceful degradation when data is unavailable

**Output:**

- Value range (low, median, high) based on percentiles
- Comparable sales count
- Data sources used
- Confidence score (0.0-1.0)
- Market volatility metric
- AI-generated market summary and recommendations
- Trend analysis (rising, falling, stable)

---

## Architecture Overview

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Step Functions Workflow                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Pricing Agent Lambda                         │
│                                                                   │
│  Input:                                                           │
│  • User ID, Card ID, Request ID                                  │
│  • Feature Envelope (from Rekognition)                           │
│  • Card Metadata (name, set, rarity, number)                     │
│  • OCR Reasoning Metadata (optional, preferred)                  │
│  • Condition Estimate                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
```

┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Card Identification │
│ │
│ 1. Extract card identifiers from metadata │
│ • Prefer OCR Reasoning metadata (AI-verified) │
│ • Fallback to legacy metadata extraction │
│ • Extract: name, set, rarity, collector number │
│ │
│ 2. Determine card condition │
│ • Use provided condition estimate │
│ • Default to "Near Mint" if not specified │
│ │
│ Output: PriceQuery object │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Multi-Source Data Fetch │
│ │
│ Pricing Orchestrator coordinates multiple sources: │
│ │
│ 1. Check source availability (circuit breaker) │
│ • Skip sources with open circuit breakers │
│ • Log unavailable sources │
│ │
│ 2. Fetch from all available sources in parallel │
│ ┌─────────────────────────────────────────┐ │
│ │ Pokémon TCG API (Primary Source) │ │
│ │ • Free tier: 20 req/min │ │
│ │ • TCGPlayer market prices │ │
│ │ • CardMarket European prices │ │
│ │ • Rate limiting enforced │ │
│ │ • Circuit breaker protection │ │
│ │ • Retry with exponential backoff │ │
│ └─────────────────────────────────────────┘ │
│ │
│ Future sources (when API keys available): │
│ • eBay sold listings │
│ • TCGPlayer direct API │
│ • PriceCharting historical data │
│ │
│ 3. Aggregate results from all successful sources │
│ • Continue if some sources fail │
│ • Log failures for monitoring │
│ • Return empty array if all sources fail │
│ │
│ Output: RawComp[] (raw comparable sales) │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Data Normalization │
│ │
│ Pricing Service normalizes raw data: │
│ │
│ 1. Currency Conversion │
│ • Convert all prices to USD │
│ • Use exchange rates: EUR, GBP, CAD, AUD, JPY │
│ • Log unknown currencies │
│ │
│ 2. Condition Standardization │
│ • Map to 5-point scale: │
│ - Poor (Damaged, Heavily Played) │
│ - Good (Played, Moderately Played) │
│ - Excellent (Lightly Played, Very Good) │
│ - Near Mint (Like New) │
│ - Mint (Gem, Pristine) │
│ │
│ 3. Date Parsing │
│ • Convert sold dates to Date objects │
│ • Validate date ranges │
│ │
│ 4. Validation │
│ • Remove invalid prices (≤ 0, NaN) │
│ • Log normalization failures │
│ │
│ Output: NormalizedComp[] (standardized data) │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Outlier Removal │
│ │
│ Statistical outlier detection using IQR method: │
│ │
│ 1. Sort prices in ascending order │
│ 2. Calculate quartiles: │
│ • Q1 = 25th percentile │
│ • Q3 = 75th percentile │
│ • IQR = Q3 - Q1 │
│ │
│ 3. Define outlier bounds: │
│ • Lower bound = Q1 - 1.5 × IQR │
│ • Upper bound = Q3 + 1.5 × IQR │
│ │
│ 4. Filter outliers: │
│ • Remove prices < lower bound │
│ • Remove prices > upper bound │
│ • Keep all if < 4 data points │
│ │
│ 5. Fallback protection: │
│ • If all filtered, use original data │
│ • Log outlier removal statistics │
│ │
│ Output: Filtered NormalizedComp[] │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: Statistical Analysis │
│ │
│ Compute pricing metrics from filtered data: │
│ │
│ 1. Percentile Calculation │
│ • Value Low = 10th percentile │
│ • Value Median = 50th percentile (median) │
│ • Value High = 90th percentile │
│ • Uses linear interpolation for precision │
│ │
│ 2. Confidence Score (0.0-1.0) │
│ • Sample Size Factor (60% weight): │
│ - Higher sample size = higher confidence │
│ - Normalized to 50 samples = 1.0 │
│ • Variance Factor (40% weight): │
│ - Lower coefficient of variation = higher confidence │
│ - CV = standard deviation / mean │
│ │
│ 3. Volatility Metric │
│ • Coefficient of Variation (CV) │
│ • CV = σ / μ (std dev / mean) │
│ • Higher CV = more volatile market │
│ │
│ 4. Source Aggregation │
│ • List unique sources used │
│ • Track comps count per source │
│ │
│ Output: PricingResult │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 6: AI Valuation (Bedrock) │
│ │
│ 1. Construct detailed prompt with: │
│ • Card information (name, set, condition) │
│ • Pricing data (range, median, comps count) │
│ • Market metrics (confidence, volatility) │
│ • Data sources and window │
│ │
│ 2. Invoke Amazon Bedrock (Claude 4.0 Sonnet) │
│ • System prompt: Expert valuator persona │
│ • User prompt: Structured analysis request │
│ • Temperature: 0.2 (deterministic) │
│ • Max tokens: 2048 │
│ │
│ 3. Parse AI response (JSON format) │
│ • Market summary (2-3 sentences) │
│ • Fair value estimate │
│ • Trend (rising, falling, stable) │
│ • Recommendation for collectors/sellers │
│ • Confidence score │
│ │
│ 4. Fallback on AI failure │
│ • Use median as fair value │
│ • Generate basic summary from data │
│ • Mark trend as "stable" │
│ • Reduce confidence score │
│ │
│ Output: ValuationSummary │
└─────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────┐
│ Return to Step Functions │
│ │
│ PricingAgentOutput: │
│ • pricingResult: PricingResult │
│ • valuationSummary: ValuationSummary │
│ • requestId: string │
└─────────────────────────────────────────────────────────────────┘

````

---

## Detailed Component Analysis

### 1. Pricing Orchestrator

#### Purpose
Coordinates multiple pricing sources, manages parallel fetching, and aggregates results.

#### Architecture

**Source Management:**
```typescript
class PricingOrchestrator {
  private sources: PriceSource[] = [
    new PokemonTCGAdapter(),
    // Future: new EbayAdapter(),
    // Future: new TCGPlayerAdapter(),
    // Future: new PriceChartingAdapter(),
  ];
}
````

**Parallel Fetching Strategy:**

```typescript
async fetchAllComps(query: PriceQuery): Promise<PricingResult> {
  // 1. Check availability (circuit breaker)
  const availableSources = await this.checkAvailability();

  // 2. Fetch in parallel using Promise.allSettled
  const results = await Promise.allSettled(
    availableSources.map(source => source.fetchComps(query))
  );

  // 3. Aggregate successful results
  const allComps = this.aggregateResults(results);

  // 4. Normalize and fuse
  return this.pricingService.fuse(
    this.pricingService.normalize(allComps),
    query
  );
}
```

**Why Promise.allSettled?**

- Doesn't fail if one source fails
- Returns all results (fulfilled or rejected)
- Allows partial success
- Better fault tolerance than Promise.all

**Graceful Degradation:**

```typescript
if (allComps.length === 0) {
  // Return fallback result instead of throwing
  return {
    valueLow: 0,
    valueMedian: 0,
    valueHigh: 0,
    compsCount: 0,
    sources: [],
    confidence: 0,
    message: 'No pricing data available from any source',
  };
}
```

**Pros:**

- Fault-tolerant (continues if some sources fail)
- Parallel execution (faster than sequential)
- Extensible (easy to add new sources)
- Centralized coordination

**Cons:**

- Complexity increases with more sources
- Requires careful error handling
- Potential for inconsistent data formats

---

### 2. Pokémon TCG API Adapter

#### Overview

The Pokémon TCG API is the primary pricing source for CollectIQ. It provides:

- Free tier with 20 requests/minute
- TCGPlayer market prices (US market)
- CardMarket prices (European market)
- Card metadata (set, rarity, images)
- No approval process required

**API Endpoint:**

```
https://api.pokemontcg.io/v2/cards
```

#### Search Query Construction

**Challenge:** The API uses a specific query syntax that requires careful construction.

**Query Syntax:**

```
field:"value" field2:"value2"
```

**Implementation:**

```typescript
private buildSearchQuery(query: PriceQuery): string {
  const conditions: string[] = [];

  // Card name (quoted for phrase matching)
  if (query.cardName) {
    const cleanName = query.cardName.replace(/[^\w\s-]/g, '').trim();
    if (!/^\d+$/.test(cleanName)) {  // Skip if just a number
      conditions.push(`name:"${cleanName}"`);
    }
  }

  // Set name (quoted for phrase matching)
  if (query.set) {
    const cleanSet = query.set.replace(/[^\w\s-]/g, '').trim();
    conditions.push(`set.name:"${cleanSet}"`);
  }

  // Skip collector number (often has special characters)

  return conditions.join(' ');  // AND logic
}
```

**Why Skip Collector Number?**

- Often contains special characters (#, /, -)
- API query syntax doesn't handle them well
- Name + Set is sufficient for identification
- Reduces query failures

**Fallback Search:**
If no results found, try simplified search with just card name:

```typescript
if (data.data.length === 0 && query.cardName) {
  const simpleUrl = `${BASE_URL}/cards?q=name:${query.cardName}`;
  const simpleResponse = await fetch(simpleUrl);
  // Return simplified results
}
```

#### Price Variant Selection

**Challenge:** Cards have multiple price variants (holo, non-holo, reverse holo, 1st edition).

**Price Structure:**

```typescript
interface TCGPlayerPrices {
  holofoil?: PricePoint;
  reverseHolofoil?: PricePoint;
  normal?: PricePoint;
  '1stEditionHolofoil'?: PricePoint;
  '1stEditionNormal'?: PricePoint;
  unlimitedHolofoil?: PricePoint;
}

interface PricePoint {
  low: number;
  mid: number;
  high: number;
  market: number;
  directLow?: number;
}
```

**Selection Logic:**

```typescript
private selectPriceVariant(prices: TCGPlayerPrices, rarity: string): PricePoint | null {
  // Holographic cards
  if (this.isHolographic(rarity)) {
    return prices.holofoil || prices.reverseHolofoil || prices.unlimitedHolofoil;
  }

  // Reverse holo
  if (rarity?.toLowerCase().includes('reverse')) {
    return prices.reverseHolofoil || prices.normal;
  }

  // 1st Edition
  if (rarity?.toLowerCase().includes('1st edition')) {
    return prices['1stEditionNormal'] || prices.normal;
  }

  // Default to normal, fallback to holofoil
  return prices.normal || prices.holofoil;
}
```

**Holographic Detection:**

```typescript
private isHolographic(rarity?: string): boolean {
  const holoKeywords = [
    'holo', 'holographic', 'ultra rare', 'secret rare',
    'rainbow rare', 'full art', 'vmax', 'vstar', 'ex', 'gx'
  ];
  return holoKeywords.some(keyword =>
    rarity?.toLowerCase().includes(keyword)
  );
}
```

#### Comparable Extraction

**Strategy:** Extract multiple price points from each card to increase sample size.

```typescript
private extractCompsFromCard(card: PokemonTCGCard, query: PriceQuery): RawComp[] {
  const comps: RawComp[] = [];

  // TCGPlayer prices (US market)
  if (card.tcgplayer?.prices) {
    const variant = this.selectPriceVariant(card.tcgplayer.prices, card.rarity);

    if (variant) {
      // Add low, market, and high as separate comps
      if (variant.low) comps.push({ price: variant.low, ... });
      if (variant.market) comps.push({ price: variant.market, ... });
      if (variant.high) comps.push({ price: variant.high, ... });
    }
  }

  // CardMarket prices (European market)
  if (card.cardmarket?.prices) {
    if (prices.trendPrice) comps.push({ price: prices.trendPrice, currency: 'EUR', ... });
    if (prices.averageSellPrice) comps.push({ price: prices.averageSellPrice, currency: 'EUR', ... });
  }

  return comps;
}
```

**Why Multiple Price Points?**

- Increases sample size
- Captures price range
- Provides more data for statistical analysis
- Outlier removal will filter extremes

#### Rate Limiting

**Free Tier Limit:** 20 requests per minute

**Implementation:**

```typescript
class BasePriceAdapter {
  private rateLimit: RateLimitState = {
    requests: [],
    windowMs: 60000, // 1 minute window
    maxRequests: 20, // 20 requests per minute
  };

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.rateLimit.windowMs;

    // Remove old requests outside window
    this.rateLimit.requests = this.rateLimit.requests.filter(
      (timestamp) => timestamp > windowStart
    );

    // Check if limit exceeded
    if (this.rateLimit.requests.length >= this.rateLimit.maxRequests) {
      const oldestRequest = this.rateLimit.requests[0];
      const waitTime = oldestRequest + this.rateLimit.windowMs - now;

      await this.sleep(waitTime);
      return this.checkRateLimit(); // Recursive check
    }

    // Add current request
    this.rateLimit.requests.push(now);
  }
}
```

**Why Sliding Window?**

- More accurate than fixed window
- Prevents burst at window boundaries
- Smoother rate limiting
- Better API compliance

**Pros:**

- Prevents API bans
- Automatic throttling
- Transparent to caller
- Configurable per source

**Cons:**

- Adds latency when limit reached
- Memory overhead for tracking requests
- Complexity in concurrent scenarios

---

### 3. Circuit Breaker Pattern

#### Purpose

Prevents cascading failures by temporarily disabling failing services.

#### State Machine

```
┌─────────┐
│ CLOSED  │ ◄─── Normal operation
└────┬────┘
     │ Failure threshold reached (5 failures)
     ▼
┌─────────┐
│  OPEN   │ ◄─── Service unavailable
└────┬────┘
     │ Timeout elapsed (60 seconds)
     ▼
┌─────────┐
│ HALF-   │ ◄─── Testing recovery
│ OPEN    │
└────┬────┘
     │ Success: Reset to CLOSED
     │ Failure: Back to OPEN
```

#### Implementation

```typescript
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

class BasePriceAdapter {
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
  };

  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 60 seconds

  async isAvailable(): Promise<boolean> {
    if (this.circuitBreaker.isOpen) {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;

      // Try to close after timeout
      if (timeSinceLastFailure >= this.CIRCUIT_BREAKER_TIMEOUT) {
        this.circuitBreaker.isOpen = false;
        this.circuitBreaker.failures = 0;
        return true;
      }

      return false; // Still open
    }

    return true; // Closed
  }

  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
    }
  }

  private onSuccess(): void {
    if (this.circuitBreaker.failures > 0) {
      this.circuitBreaker.failures = 0; // Reset on success
    }
  }
}
```

#### Why Circuit Breaker?

**Without Circuit Breaker:**

- Repeated calls to failing service
- Wasted resources and time
- Cascading failures
- Poor user experience

**With Circuit Breaker:**

- Fast failure (no waiting for timeout)
- Resource conservation
- Automatic recovery testing
- System stability

**Pros:**

- Prevents cascading failures
- Automatic recovery
- Fast failure detection
- Resource efficient

**Cons:**

- May skip temporarily unavailable services
- Requires tuning (threshold, timeout)
- State management complexity

---

### 4. Retry Logic with Exponential Backoff

#### Purpose

Handle transient failures with increasing delays between retries.

#### Implementation

```typescript
class BasePriceAdapter {
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF = 1000; // 1 second

  private async executeWithRetry(query: PriceQuery): Promise<RawComp[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        const result = await this.fetchCompsInternal(query);
        this.onSuccess();
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.MAX_RETRIES - 1) {
          const backoffMs = this.INITIAL_BACKOFF * Math.pow(2, attempt);
          await this.sleep(backoffMs);
        }
      }
    }

    this.onFailure();
    return []; // Return empty instead of throwing
  }
}
```

#### Backoff Schedule

| Attempt | Delay | Cumulative Time |
| ------- | ----- | --------------- |
| 1       | 0ms   | 0ms             |
| 2       | 1s    | 1s              |
| 3       | 2s    | 3s              |
| Total   | -     | 3s + 3 requests |

**Why Exponential?**

- Gives service time to recover
- Reduces load on failing service
- Industry standard pattern
- Balances speed and reliability

**Pros:**

- Handles transient failures
- Automatic recovery
- Configurable retry count
- Graceful degradation

**Cons:**

- Adds latency on failures
- May retry unrecoverable errors
- Complexity in error handling

---

### 5. Data Normalization

#### Currency Conversion

**Supported Currencies:**

```typescript
const CURRENCY_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.65,
  JPY: 0.0067,
};
```

**Conversion Logic:**

```typescript
private convertToUSD(price: number, currency: string): number {
  const rate = CURRENCY_RATES[currency.toUpperCase()];

  if (!rate) {
    logger.warn(`Unknown currency ${currency}, assuming USD`);
    return price;
  }

  return price * rate;
}
```

**Why USD?**

- Standard currency for comparison
- Most pricing sources use USD
- Simplifies statistical analysis
- Industry standard

**Limitation:**

- Static exchange rates (should use live rates in production)
- No historical rate tracking
- Assumes instant conversion

#### Condition Standardization

**5-Point Scale:**

```
Poor < Good < Excellent < Near Mint < Mint
```

**Mapping Logic:**

```typescript
private normalizeCondition(condition: string): StandardCondition {
  const normalized = condition.toLowerCase().trim();

  // Mint: gem, pristine, mint
  if (normalized.includes('gem') || normalized.includes('pristine')) {
    return 'Mint';
  }

  // Near Mint: near mint, nm, like new, excellent+
  if (normalized.includes('near mint') || normalized.includes('nm')) {
    return 'Near Mint';
  }

  // Excellent: excellent, very good, lightly played, lp
  if (normalized.includes('excellent') || normalized.includes('lightly played')) {
    return 'Excellent';
  }

  // Good: good, played, moderately played, mp
  if (normalized.includes('good') || normalized.includes('moderately played')) {
    return 'Good';
  }

  // Poor: poor, damaged, heavily played, hp
  if (normalized.includes('poor') || normalized.includes('damaged')) {
    return 'Poor';
  }

  // Default to Good if unknown
  return 'Good';
}
```

**Why Standardize?**

- Different sources use different terms
- Enables comparison across sources
- Simplifies statistical analysis
- User-friendly display

**Pros:**

- Consistent condition representation
- Handles various naming conventions
- Extensible mapping

**Cons:**

- May lose granularity
- Subjective condition assessment
- Source-specific nuances lost

---

### 6. Outlier Removal (IQR Method)

#### Purpose

Remove extreme prices that skew the valuation (e.g., auction anomalies, data errors).

#### Interquartile Range (IQR) Method

**Algorithm:**

```
1. Sort prices: [p1, p2, p3, ..., pn]
2. Calculate Q1 (25th percentile)
3. Calculate Q3 (75th percentile)
4. Calculate IQR = Q3 - Q1
5. Define bounds:
   - Lower bound = Q1 - 1.5 × IQR
   - Upper bound = Q3 + 1.5 × IQR
6. Remove prices outside bounds
```

**Implementation:**

```typescript
private removeOutliers(comps: NormalizedComp[]): NormalizedComp[] {
  if (comps.length < 4) {
    return comps;  // Not enough data for IQR
  }

  const sorted = [...comps].sort((a, b) => a.price - b.price);
  const prices = sorted.map(c => c.price);

  const q1 = this.percentile(prices, 25);
  const q3 = this.percentile(prices, 75);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const filtered = comps.filter(comp =>
    comp.price >= lowerBound && comp.price <= upperBound
  );

  // Fallback if all filtered
  if (filtered.length === 0) {
    return comps;
  }

  return filtered;
}
```

#### Example Scenario

**Raw Prices:** [5, 10, 12, 15, 18, 20, 22, 100]

**Calculation:**

- Q1 = 11 (25th percentile)
- Q3 = 21 (75th percentile)
- IQR = 21 - 11 = 10
- Lower bound = 11 - 1.5 × 10 = -4
- Upper bound = 21 + 1.5 × 10 = 36

**Result:** Remove 100 (outlier)
**Filtered Prices:** [5, 10, 12, 15, 18, 20, 22]

**Why IQR?**

- Robust to extreme outliers
- Doesn't assume normal distribution
- Industry standard method
- Mathematically sound

**Pros:**

- Removes auction anomalies
- Improves valuation accuracy
- Handles skewed distributions
- Automatic detection

**Cons:**

- May remove legitimate high-value sales
- Requires minimum 4 data points
- Can be too aggressive with small samples
- Doesn't consider temporal patterns

---

### 7. Statistical Analysis

#### Percentile Calculation

**Why Percentiles?**

- More robust than mean (not affected by outliers)
- Provides value range
- Industry standard for pricing
- User-friendly interpretation

**Implementation:**

```typescript
private percentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return sortedArray[0];

  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedArray[lower];
  }

  // Linear interpolation
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
}
```

**Percentile Selection:**

- **10th percentile (valueLow):** Conservative low estimate
- **50th percentile (valueMedian):** Typical market price
- **90th percentile (valueHigh):** Premium high estimate

**Why Not Min/Max?**

- Min/Max are extreme outliers
- Not representative of market
- Percentiles more stable
- Better user experience

#### Confidence Score

**Formula:**

```
Confidence = (Sample Size Factor × 0.6) + (Variance Factor × 0.4)
```

**Sample Size Factor:**

```typescript
const sampleSizeFactor = Math.min(prices.length / 50, 1.0);
```

- 50+ samples = 1.0 (maximum confidence)
- Linear scaling below 50
- Rewards more data

**Variance Factor:**

```typescript
const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
const stdDev = Math.sqrt(variance);
const coefficientOfVariation = stdDev / mean;
const varianceFactor = Math.max(0, 1 - coefficientOfVariation);
```

- Lower CV = higher confidence
- Rewards price consistency
- Penalizes volatile markets

**Interpretation:**

- 0.8-1.0: High confidence (large sample, low variance)
- 0.6-0.8: Good confidence (decent sample, moderate variance)
- 0.4-0.6: Moderate confidence (small sample or high variance)
- 0.0-0.4: Low confidence (very small sample or very high variance)

#### Volatility Metric

**Coefficient of Variation (CV):**

```typescript
const volatility = stdDev / mean;
```

**Interpretation:**

- CV < 0.2: Low volatility (stable market)
- CV 0.2-0.5: Moderate volatility (typical market)
- CV > 0.5: High volatility (unstable market)

**Use Cases:**

- Investment decisions
- Risk assessment
- Market trend analysis
- AI valuation input

---

### 8. AI Valuation Layer (Amazon Bedrock)

#### Purpose

Provide human-readable market insights and recommendations beyond raw statistics.

#### System Prompt

```
You are an expert Pokémon TCG card valuator with extensive knowledge of market
trends, card conditions, and pricing dynamics.

Your task is to analyze pricing data and provide a fair market valuation with
actionable recommendations. You will receive:
1. Aggregated pricing data from multiple sources (eBay, TCGPlayer, PriceCharting)
2. Card condition information
3. Market confidence and volatility metrics

Based on this data, provide:
1. A concise 2-3 sentence summary of the card's value
2. A fair value estimate
3. Market trend assessment (rising, falling, or stable)
4. A brief recommendation for collectors or sellers

Be practical and data-driven. Consider market confidence and volatility in
your assessment.
```

#### User Prompt Structure

```
Analyze the market valuation for this Pokémon card:

**Card Information:**
- Name: Charizard
- Set: Base Set
- Condition: Near Mint

**Pricing Data:**
- Value Range: $150.00 - $250.00
- Median Value: $180.00
- Comparables Count: 24
- Data Window: 14 days
- Sources: PokemonTCG
- Market Confidence: 78.5%
- Volatility: 15.2%

Provide your analysis in the following JSON format:
{
  "summary": "<2-3 sentence market summary>",
  "fairValue": <number>,
  "trend": "<rising|falling|stable>",
  "recommendation": "<brief recommendation>",
  "confidence": <number between 0.0 and 1.0>
}
```

#### AI Response Example

```json
{
  "summary": "This Base Set Charizard in Near Mint condition shows strong market demand with consistent pricing around $180. The 78.5% confidence score and low volatility (15.2%) indicate a stable, well-established market with reliable pricing data.",
  "fairValue": 185.0,
  "trend": "stable",
  "recommendation": "Good time to buy or sell. The stable market and strong confidence suggest fair pricing. Consider grading if condition is truly Near Mint to potentially increase value.",
  "confidence": 0.82
}
```

#### Fallback Mechanism

If Bedrock fails:

```typescript
return {
  summary: `Based on ${pricingResult.compsCount} recent sales, this card is valued between ${pricingResult.valueLow.toFixed(2)} and ${pricingResult.valueHigh.toFixed(2)}. AI analysis unavailable.`,
  fairValue: pricingResult.valueMedian,
  trend: 'stable',
  recommendation: 'Manual review recommended for accurate valuation.',
  confidence: Math.max(0.3, pricingResult.confidence * 0.7), // Reduced confidence
};
```

**Why AI Valuation?**

- Human-readable insights
- Contextual understanding
- Trend analysis
- Actionable recommendations
- Better user experience

**Pros:**

- Natural language output
- Considers market context
- Provides recommendations
- Enhances raw statistics

**Cons:**

- Adds latency (2-3s)
- Costs $0.003-0.015 per call
- May fail (requires fallback)
- Non-deterministic (despite low temperature)

---

## Data Structures

### Input: PricingAgentInput

```typescript
interface PricingAgentInput {
  userId: string;
  cardId: string;
  features: FeatureEnvelope;
  cardMeta: {
    name?: string;
    set?: string;
    number?: string;
    rarity?: string;
    conditionEstimate?: string;
    ocrMetadata?: {
      name?: { value: string | null; confidence: number; rationale: string };
      rarity?: { value: string | null; confidence: number; rationale: string };
      set?:
        | { value: string | null; confidence: number; rationale: string }
        | {
            value: string | null;
            candidates: Array<{ value: string; confidence: number }>;
            rationale: string;
          };
      collectorNumber?: { value: string | null; confidence: number; rationale: string };
      overallConfidence?: number;
      reasoningTrail?: string;
      verifiedByAI?: boolean;
    };
  };
  requestId: string;
}
```

### PriceQuery

```typescript
interface PriceQuery {
  cardName: string;
  set?: string;
  number?: string;
  condition?: string;
  windowDays: number; // Default: 14
}
```

### RawComp (from pricing sources)

```typescript
interface RawComp {
  source: string; // 'PokemonTCG', 'eBay', etc.
  price: number;
  currency: string; // 'USD', 'EUR', 'GBP', etc.
  condition: string; // Source-specific condition
  soldDate: string; // ISO 8601 datetime
  listingUrl?: string; // Optional link to listing
}
```

### NormalizedComp (after normalization)

```typescript
interface NormalizedComp {
  source: string;
  price: number; // Always in USD
  condition: StandardCondition; // Standardized 5-point scale
  soldDate: Date;
  listingUrl?: string;
}

type StandardCondition = 'Poor' | 'Good' | 'Excellent' | 'Near Mint' | 'Mint';
```

### Output: PricingResult

```typescript
interface PricingResult {
  valueLow: number; // 10th percentile
  valueMedian: number; // 50th percentile (median)
  valueHigh: number; // 90th percentile
  compsCount: number; // Number of comparables used
  windowDays: number; // Data window (default 14)
  sources: string[]; // Sources used
  confidence: number; // 0.0-1.0
  volatility: number; // Coefficient of variation
  message?: string; // Optional message (e.g., "No data available")
}
```

### Output: ValuationSummary

```typescript
interface ValuationSummary {
  summary: string; // 2-3 sentence market summary
  fairValue: number; // AI-estimated fair value
  trend: 'rising' | 'falling' | 'stable';
  recommendation: string; // Brief recommendation
  confidence: number; // 0.0-1.0
}
```

### Output: PricingAgentOutput

```typescript
interface PricingAgentOutput {
  pricingResult: PricingResult;
  valuationSummary: ValuationSummary;
  requestId: string;
}
```

---

## Error Handling and Edge Cases

### 1. No Pricing Data Available

**Scenario:** All pricing sources return empty results.

**Behavior:**

```typescript
if (rawComps.length === 0) {
  return {
    valueLow: 0,
    valueMedian: 0,
    valueHigh: 0,
    compsCount: 0,
    sources: [],
    confidence: 0,
    message: 'No pricing data available from any source',
  };
}
```

**Impact:**

- Agent doesn't fail
- Returns zero values with message
- Aggregator persists result
- Frontend displays "No pricing data"

**Mitigation:**

- Add more pricing sources
- Improve search query construction
- Expand card database coverage

### 2. All Sources Fail

**Scenario:** All pricing sources have open circuit breakers or fail.

**Behavior:**

```typescript
const availableSources = await this.checkAvailability();

if (availableSources.length === 0) {
  throw new Error('All pricing sources are unavailable');
}
```

**Impact:**

- Pricing Agent throws error
- Step Functions catches error
- Retry logic may attempt again
- Eventually fails if persistent

**Mitigation:**

- Multiple diverse sources
- Circuit breaker timeout (60s)
- Retry with exponential backoff
- Monitoring and alerts

### 3. Rate Limit Exceeded

**Scenario:** Too many requests to Pokémon TCG API.

**Behavior:**

```typescript
if (this.rateLimit.requests.length >= this.rateLimit.maxRequests) {
  const waitTime = /* calculate wait time */;
  await this.sleep(waitTime);
  return this.checkRateLimit();  // Recursive check
}
```

**Impact:**

- Automatic throttling
- Adds latency (up to 60s)
- Transparent to caller
- Prevents API ban

**Mitigation:**

- Conservative rate limits (20/min vs API's actual limit)
- Request batching
- Caching (future enhancement)
- Multiple API keys

### 4. Invalid Card Name

**Scenario:** OCR extracts incorrect card name (e.g., just a number).

**Behavior:**

```typescript
const cleanName = query.cardName.replace(/[^\w\s-]/g, '').trim();

if (/^\d+$/.test(cleanName)) {
  logger.warn('Card name appears to be just a number, likely OCR error');
  // Skip name condition in query
}
```

**Impact:**

- Simplified search (set only)
- May return multiple cards
- Reduced precision
- Still provides pricing data

**Mitigation:**

- OCR Reasoning Agent improves accuracy
- Fallback to simplified search
- Manual user correction
- Confidence scoring

### 5. All Comps Filtered as Outliers

**Scenario:** IQR method filters all data points.

**Behavior:**

```typescript
const filtered = this.removeOutliers(comps);

if (filtered.length === 0) {
  logger.warn('All comps were filtered as outliers, using original data');
  return this.computePricingResult(comps, query);
}
```

**Impact:**

- Falls back to original data
- Prevents empty result
- Logs warning for investigation
- Continues processing

**Mitigation:**

- Adjust IQR multiplier (1.5 is standard)
- Minimum sample size check (4 points)
- Manual review of edge cases

### 6. Bedrock Service Outage

**Scenario:** Bedrock API unavailable.

**Behavior:**

```typescript
try {
  return await bedrockService.invokeValuation(context);
} catch (error) {
  // Fallback to basic valuation
  return {
    summary: `Based on ${compsCount} recent sales...`,
    fairValue: pricingResult.valueMedian,
    trend: 'stable',
    recommendation: 'Manual review recommended.',
    confidence: pricingResult.confidence * 0.7, // Reduced
  };
}
```

**Impact:**

- System remains operational
- Basic valuation provided
- Reduced confidence score
- User notified of limitation

---

## Performance Characteristics

### Latency Breakdown

**Typical Execution Time:** 2-4 seconds

| Phase                     | Duration     | Notes                    |
| ------------------------- | ------------ | ------------------------ |
| Card Identification       | 10-20ms      | Metadata extraction      |
| Source Availability Check | 50-100ms     | Circuit breaker checks   |
| Pokémon TCG API Call      | 500-1000ms   | Network + API processing |
| Data Normalization        | 20-50ms      | Pure computation         |
| Outlier Removal           | 10-30ms      | Sorting + filtering      |
| Statistical Analysis      | 10-20ms      | Percentile calculation   |
| Bedrock Invocation        | 2-3s         | Network + AI inference   |
| **Total**                 | **2.5-4.5s** | End-to-end               |

**With Rate Limiting:**

- Wait time: 0-60s (if limit exceeded)
- Rare in normal operation
- More common during bursts

**With Retries:**

- First retry: +1s
- Second retry: +2s
- Third retry: +4s
- Maximum: ~7s additional

### Cost Analysis

**Per Pricing Check:**

| Component           | Cost              | Notes                          |
| ------------------- | ----------------- | ------------------------------ |
| Lambda execution    | $0.0000002        | 1GB RAM, 4s duration           |
| Pokémon TCG API     | $0                | Free tier                      |
| Bedrock invocation  | $0.003-0.015      | Claude 4.0 Sonnet, ~500 tokens |
| **Total per check** | **~$0.003-0.015** | Dominated by Bedrock cost      |

**Monthly Cost (1000 cards):**

- $3-15 for Bedrock
- <$1 for Lambda
- $0 for Pokémon TCG API (free tier)
- **Total: $3-16/month**

**Cost Optimization:**

- Cache pricing results (future)
- Batch Bedrock calls (future)
- Use cheaper AI models for simple cases
- Skip AI for low-value cards

### Scalability

**Bottlenecks:**

1. **Pokémon TCG API Rate Limit:**
   - 20 requests/minute (free tier)
   - Can upgrade with API key
   - Caching would help significantly

2. **Bedrock Rate Limits:**
   - 10 requests/second (default)
   - Can request increase
   - Retry logic handles bursts

3. **Lambda Concurrency:**
   - 1000 concurrent executions (default)
   - Can request increase
   - Step Functions manages parallelism

**Horizontal Scaling:**

- Lambda auto-scales
- Multiple pricing sources distribute load
- Circuit breakers prevent overload
- No single point of failure

---

## Pros and Cons Analysis

### Overall System Pros

✅ **Multi-Source Aggregation**

- Reduces dependency on single source
- Increases data coverage
- Improves accuracy through diversity
- Fault-tolerant design

✅ **Statistical Rigor**

- Outlier removal (IQR method)
- Percentile-based valuation
- Confidence scoring
- Volatility metrics

✅ **Fault Tolerance**

- Circuit breaker pattern
- Retry with exponential backoff
- Graceful degradation
- Continues with partial data

✅ **Rate Limiting**

- Prevents API bans
- Automatic throttling
- Configurable per source
- Transparent to caller

✅ **AI Enhancement**

- Human-readable insights
- Market trend analysis
- Actionable recommendations
- Better user experience

✅ **Extensible Architecture**

- Easy to add new sources
- Pluggable adapters
- Centralized orchestration
- Clean separation of concerns

### Overall System Cons

❌ **Single Source Dependency (Current)**

- Only Pokémon TCG API implemented
- No redundancy if source fails
- Limited to TCGPlayer/CardMarket data
- Missing eBay sold listings

❌ **Rate Limiting Constraints**

- 20 requests/minute (free tier)
- Can cause delays during bursts
- Limits scalability
- Requires caching for high volume

❌ **Static Currency Rates**

- Not using live exchange rates
- May be inaccurate over time
- No historical rate tracking
- Assumes instant conversion

❌ **No Caching**

- Repeated API calls for same card
- Wasted resources and time
- Higher costs
- Slower response times

❌ **Limited Historical Data**

- 14-day window only
- No long-term trend analysis
- Can't detect seasonal patterns
- Missing investment insights

❌ **AI Cost**

- $0.003-0.015 per valuation
- Not suitable for free tier
- Costs scale linearly
- May be overkill for common cards

### Component-Specific Pros and Cons

#### Pokémon TCG API Adapter

**Pros:**

- Free tier available
- No approval process
- Good data coverage
- TCGPlayer + CardMarket prices
- Card metadata included

**Cons:**

- Rate limited (20/min free tier)
- Query syntax quirks
- Missing eBay data
- US/EU markets only
- No historical trends

#### Circuit Breaker Pattern

**Pros:**

- Prevents cascading failures
- Automatic recovery
- Fast failure detection
- Resource efficient

**Cons:**

- May skip temporarily unavailable services
- Requires tuning
- State management complexity
- False positives possible

#### IQR Outlier Removal

**Pros:**

- Robust to extreme outliers
- Doesn't assume normal distribution
- Industry standard
- Automatic detection

**Cons:**

- May remove legitimate high-value sales
- Requires minimum 4 data points
- Can be too aggressive
- Doesn't consider temporal patterns

#### AI Valuation

**Pros:**

- Human-readable insights
- Contextual understanding
- Trend analysis
- Actionable recommendations

**Cons:**

- Adds latency (2-3s)
- Costs $0.003-0.015 per call
- May fail (requires fallback)
- Non-deterministic

---

## Future Improvements

### 1. Add More Pricing Sources

**Goal:** Reduce single-source dependency and increase data coverage.

**Sources to Add:**

- **eBay Sold Listings:** Real transaction data, large volume
- **TCGPlayer Direct API:** More detailed pricing, graded cards
- **PriceCharting:** Historical trends, investment data
- **Cardmarket API:** European market depth

**Implementation:**

```typescript
class PricingOrchestrator {
  private sources: PriceSource[] = [
    new PokemonTCGAdapter(),
    new EbayAdapter(), // New
    new TCGPlayerAdapter(), // New
    new PriceChartingAdapter(), // New
  ];
}
```

**Impact:**

- Higher confidence scores
- Better coverage for rare cards
- Redundancy if one source fails
- More accurate valuations

### 2. Implement Caching Layer

**Goal:** Reduce API calls and improve response times.

**Approach:**

- Cache pricing results in DynamoDB
- TTL: 1 hour for common cards, 24 hours for rare cards
- Invalidate on user request
- Background refresh for popular cards

**Implementation:**

```typescript
async fetchAllComps(query: PriceQuery): Promise<PricingResult> {
  // Check cache first
  const cached = await this.cache.get(query);
  if (cached && !cached.isExpired()) {
    return cached.result;
  }

  // Fetch fresh data
  const result = await this.fetchFromSources(query);

  // Update cache
  await this.cache.set(query, result, ttl);

  return result;
}
```

**Impact:**

- 90%+ cache hit rate (estimated)
- Sub-second response times
- Reduced API costs
- Better scalability

### 3. Historical Trend Analysis

**Goal:** Provide investment insights and seasonal patterns.

**Approach:**

- Store pricing snapshots in DynamoDB
- Track price changes over time
- Detect seasonal patterns
- Predict future trends

**Data Structure:**

```typescript
interface PriceSnapshot {
  cardId: string;
  timestamp: string;
  valueMedian: number;
  compsCount: number;
  sources: string[];
}
```

**Analysis:**

```typescript
interface TrendAnalysis {
  priceChange30d: number; // % change over 30 days
  priceChange90d: number; // % change over 90 days
  seasonalPattern: string; // 'summer-peak', 'holiday-spike', etc.
  investmentGrade: 'A' | 'B' | 'C' | 'D';
  predictedTrend: 'bullish' | 'bearish' | 'neutral';
}
```

**Impact:**

- Better investment decisions
- Seasonal buying/selling strategies
- Long-term value tracking
- Enhanced AI insights

### 4. Live Currency Conversion

**Goal:** Accurate multi-currency pricing.

**Approach:**

- Integrate with currency API (e.g., exchangerate-api.com)
- Cache rates for 1 hour
- Historical rate tracking
- Multi-currency display

**Implementation:**

```typescript
class CurrencyService {
  private cache: Map<string, { rate: number; timestamp: number }>;

  async getRate(from: string, to: string): Promise<number> {
    const cached = this.cache.get(`${from}-${to}`);
    if (cached && Date.now() - cached.timestamp < 3600000) {
      return cached.rate;
    }

    const rate = await this.fetchLiveRate(from, to);
    this.cache.set(`${from}-${to}`, { rate, timestamp: Date.now() });
    return rate;
  }
}
```

**Impact:**

- Accurate international pricing
- Better European market support
- Historical accuracy
- Professional presentation

### 5. Graded Card Support

**Goal:** Accurate pricing for PSA/BGS graded cards.

**Approach:**

- Detect graded cards from images
- Separate pricing for each grade
- Premium multipliers by grade
- Grading service recommendations

**Grade Multipliers:**

```typescript
const GRADE_MULTIPLIERS = {
  'PSA 10': 3.0,
  'PSA 9': 1.8,
  'PSA 8': 1.2,
  'BGS 10': 3.5,
  'BGS 9.5': 2.5,
  'BGS 9': 1.7,
};
```

**Impact:**

- Accurate graded card valuations
- Investment-grade insights
- Grading ROI analysis
- Premium market coverage

### 6. Machine Learning Price Prediction

**Goal:** Predict future prices using ML models.

**Approach:**

- Train on historical pricing data
- Features: rarity, set, age, popularity, market trends
- Model: Gradient Boosting or Neural Network
- Confidence intervals

**Model Input:**

```typescript
interface PricePredictionInput {
  cardName: string;
  set: string;
  rarity: string;
  releaseDate: Date;
  historicalPrices: number[];
  marketVolume: number;
  popularityScore: number;
}
```

**Model Output:**

```typescript
interface PricePrediction {
  predicted30d: number;
  predicted90d: number;
  predicted1y: number;
  confidenceInterval: [number, number];
  factors: string[]; // Key price drivers
}
```

**Impact:**

- Investment decision support
- Buy/sell timing recommendations
- Market trend forecasting
- Competitive advantage

---

## Integration with CollectIQ Pipeline

### Upstream Dependencies

**1. OCR Reasoning Agent (Preferred)**

- Provides AI-verified card metadata
- Higher confidence card identification
- Better search query construction
- Reduces pricing errors

**2. Feature Extraction (Rekognition)**

- Provides condition estimate (future)
- Image quality metrics
- Card orientation detection

**3. S3 Upload**

- Card images stored for reference
- Metadata extraction source

### Downstream Consumers

**1. Aggregator Lambda**

- Receives PricingResult and ValuationSummary
- Merges with authenticity data
- Persists to DynamoDB
- Emits EventBridge events

**2. Frontend Display**

- Shows value range with visual chart
- Displays AI valuation summary
- Presents trend indicator
- Shows confidence score

**3. EventBridge Events**

- `CardValuationCompleted` event includes pricing data
- Downstream analytics
- Price alert notifications
- Investment tracking

### Step Functions Orchestration

```json
{
  "Type": "Parallel",
  "Branches": [
    {
      "StartAt": "PricingAgent",
      "States": {
        "PricingAgent": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:function:pricing-agent",
          "End": true
        }
      }
    },
    {
      "StartAt": "AuthenticityAgent",
      "States": {
        "AuthenticityAgent": {
          "Type": "Task",
          "Resource": "arn:aws:lambda:...:function:authenticity-agent",
          "End": true
        }
      }
    }
  ],
  "Next": "Aggregator"
}
```

**Parallel Execution:**

- Pricing and Authenticity run simultaneously
- Reduces total pipeline latency
- Independent failure handling
- Results merged by Aggregator

---

## Monitoring and Observability

### CloudWatch Metrics

**Custom Metrics:**

```typescript
await metrics.recordPricingSourceError(sourceName, errorType);
await metrics.recordPricingConfidence(confidence, cardId);
await metrics.recordPricingLatency(latency, sourceName);
```

**Key Metrics:**

- `PricingMedian` (average, min, max, p50, p95, p99)
- `PricingConfidence` (average, distribution)
- `PricingSourceAvailability` (per source)
- `PricingSourceLatency` (per source)
- `CompsCount` (average, min, max)
- `OutlierRemovalRate` (percentage filtered)
- `CacheHitRate` (future)

### X-Ray Tracing

**Traced Operations:**

```typescript
tracing.startSubsegment('pricing_agent_handler', { userId, cardId });
tracing.trace('pricing_fetch_all_comps', () => orchestrator.fetchAllComps(query));
tracing.trace('bedrock_invoke_valuation', () => bedrockService.invokeValuation(context));
tracing.endSubsegment('pricing_agent_handler', { success: true });
```

**Trace Insights:**

- End-to-end latency breakdown
- Source-specific performance
- Bottleneck identification
- Error correlation

### Structured Logging

**Log Levels:**

- `DEBUG`: Detailed API calls and calculations
- `INFO`: Major milestones and results
- `WARN`: Missing data, fallbacks, retries
- `ERROR`: Failures requiring attention

**Key Log Events:**

```typescript
logger.info('Pricing Agent invoked', { userId, cardId, cardName });
logger.info('Fetching pricing from all sources', { query });
logger.warn('No pricing data available from any source', { query });
logger.info('Pricing result computed', { compsCount, confidence });
logger.error('Pricing Agent failed', error, { userId, cardId });
```

### Alerting

**Critical Alerts:**

- All pricing sources unavailable
- Pricing confidence < 0.3 for extended period
- Bedrock invocation failure rate > 10%
- Lambda errors or timeouts

**Warning Alerts:**

- Single source unavailable > 5 minutes
- Rate limit exceeded frequently
- High outlier removal rate (> 50%)
- Low comps count (< 5) for popular cards

---

## Security Considerations

### 1. API Key Management

**Configuration:**

- API keys stored in AWS Secrets Manager
- Automatic rotation enabled
- Least-privilege IAM access
- Encrypted at rest and in transit

**Access Pattern:**

```typescript
private async ensureApiKey(): Promise<void> {
  if (this.apiKey) return;

  try {
    this.apiKey = await getSecret('collectiq-hackathon/tcgplayer-api-keys');
  } catch (error) {
    // Graceful degradation to free tier
    this.apiKey = null;
  }
}
```

### 2. Rate Limiting

**Protection:**

- Prevents API abuse
- Protects against bans
- Cost control
- Fair usage compliance

### 3. Input Validation

**Validation:**

- Zod schemas validate all inputs
- Card names sanitized
- Query parameters validated
- Price ranges checked

**Risk Mitigation:**

- Prevents injection attacks
- Ensures data integrity
- Catches malformed requests

### 4. Circuit Breaker

**Protection:**

- Prevents cascading failures
- Limits blast radius
- Automatic recovery
- Resource conservation

---

## Testing Strategy

### Unit Tests

**Coverage:**

- Currency conversion
- Condition normalization
- Outlier removal (IQR)
- Percentile calculation
- Confidence scoring
- Volatility calculation

**Example:**

```typescript
describe('PricingService', () => {
  describe('removeOutliers', () => {
    it('should remove extreme outliers using IQR method', () => {
      const comps = [
        { price: 10 },
        { price: 12 },
        { price: 15 },
        { price: 18 },
        { price: 20 },
        { price: 100 },
      ];

      const filtered = pricingService.removeOutliers(comps);

      expect(filtered).toHaveLength(5);
      expect(filtered.every((c) => c.price < 100)).toBe(true);
    });
  });
});
```

### Integration Tests

**Coverage:**

- Pokémon TCG API integration
- Circuit breaker behavior
- Rate limiting enforcement
- Retry logic
- Bedrock integration

**Example:**

```typescript
describe('PokemonTCGAdapter', () => {
  it('should fetch pricing for Charizard', async () => {
    const adapter = new PokemonTCGAdapter();
    const query = {
      cardName: 'Charizard',
      set: 'Base Set',
      condition: 'Near Mint',
      windowDays: 14,
    };

    const comps = await adapter.fetchComps(query);

    expect(comps.length).toBeGreaterThan(0);
    expect(comps[0].source).toBe('PokemonTCG');
    expect(comps[0].price).toBeGreaterThan(0);
  });
});
```

### E2E Tests

**Coverage:**

- Full Step Functions workflow
- Real API calls
- Real Bedrock invocations
- DynamoDB persistence

**Example:**

```typescript
describe('Full Pricing Pipeline', () => {
  it('should price Charizard card', async () => {
    const execution = await startExecution({
      cardId: 'test-card',
      cardMeta: {
        name: 'Charizard',
        set: 'Base Set',
        conditionEstimate: 'Near Mint',
      },
    });

    await waitForExecution(execution.executionArn);

    const card = await getCardFromDynamoDB('test-card');
    expect(card.valueMedian).toBeGreaterThan(0);
    expect(card.compsCount).toBeGreaterThan(0);
    expect(card.sources).toContain('PokemonTCG');
  });
});
```

---

## Troubleshooting Guide

### Issue: No Pricing Data Available

**Symptoms:**

- `compsCount: 0`
- `message: "No pricing data available"`
- Zero values for all price fields

**Possible Causes:**

1. Card name/set mismatch
2. Rare/new card not in database
3. All sources unavailable
4. Query construction error

**Diagnosis:**

```bash
# Check logs for search query
aws logs filter-pattern "Searching Pokémon TCG API" \
  --log-group-name /aws/lambda/pricing-agent

# Check source availability
aws logs filter-pattern "pricing sources unavailable" \
  --log-group-name /aws/lambda/pricing-agent
```

**Resolution:**

- Verify card name from OCR
- Check Pokémon TCG API manually
- Add more pricing sources
- Improve search query logic

### Issue: Low Confidence Scores

**Symptoms:**

- Confidence consistently < 0.5
- High volatility metrics
- Small comps count

**Possible Causes:**

1. Insufficient data (< 10 comps)
2. High price variance
3. Mixed card variants
4. Data quality issues

**Diagnosis:**

```bash
# Check comps count distribution
aws cloudwatch get-metric-statistics \
  --metric-name CompsCount \
  --namespace CollectIQ \
  --statistics Average,Minimum

# Check volatility
aws logs filter-pattern "volatility" \
  --log-group-name /aws/lambda/pricing-agent
```

**Resolution:**

- Add more pricing sources
- Improve variant detection
- Increase data window (14 → 30 days)
- Filter by condition more strictly

### Issue: Rate Limiting Delays

**Symptoms:**

- High latency (> 10s)
- Logs show "Rate limit reached"
- Frequent waits

**Possible Causes:**

1. Traffic burst
2. Too many concurrent requests
3. Low rate limit (20/min)

**Diagnosis:**

```bash
# Check rate limit events
aws logs filter-pattern "Rate limit reached" \
  --log-group-name /aws/lambda/pricing-agent

# Check request distribution
aws cloudwatch get-metric-statistics \
  --metric-name PricingSourceLatency \
  --namespace CollectIQ
```

**Resolution:**

- Implement caching layer
- Upgrade to paid API tier
- Batch requests
- Add more API keys (rotate)

### Issue: Circuit Breaker Open

**Symptoms:**

- Source marked unavailable
- Logs show "Circuit breaker open"
- Reduced data coverage

**Possible Causes:**

1. API outage
2. Network issues
3. Rate limiting (too aggressive)
4. Authentication failure

**Diagnosis:**

```bash
# Check circuit breaker status
aws logs filter-pattern "Circuit breaker opened" \
  --log-group-name /aws/lambda/pricing-agent

# Check failure patterns
aws logs filter-pattern "fetch attempt.*failed" \
  --log-group-name /aws/lambda/pricing-agent
```

**Resolution:**

- Check API status page
- Verify API keys
- Adjust circuit breaker threshold
- Wait for automatic recovery (60s)

---

## Appendix A: Example Scenarios

### Scenario 1: Popular Card with Good Data

**Input:**

- Card: Charizard, Base Set, Near Mint
- OCR confidence: 95%

**Pokémon TCG API Response:**

- 3 cards found
- 9 price points extracted (low, market, high × 3)

**Processing:**

- Normalized to USD
- 1 outlier removed (IQR)
- 8 comps remaining

**Statistical Analysis:**

- Value Low: $145.00 (10th percentile)
- Value Median: $180.00 (50th percentile)
- Value High: $225.00 (90th percentile)
- Confidence: 0.82 (good sample size, low variance)
- Volatility: 0.18 (moderate)

**AI Valuation:**

```json
{
  "summary": "Strong market demand with consistent pricing around $180. Low volatility indicates stable market.",
  "fairValue": 185.0,
  "trend": "stable",
  "recommendation": "Fair pricing. Good time to buy or sell.",
  "confidence": 0.85
}
```

**Result:** ✅ High-quality valuation

---

### Scenario 2: Rare Card with Limited Data

**Input:**

- Card: Umbreon VMAX, Evolving Skies, Secret Rare
- OCR confidence: 88%

**Pokémon TCG API Response:**

- 1 card found
- 3 price points extracted

**Processing:**

- Normalized to USD
- No outliers (< 4 points)
- 3 comps used

**Statistical Analysis:**

- Value Low: $85.00
- Value Median: $95.00
- Value High: $110.00
- Confidence: 0.42 (small sample)
- Volatility: 0.12 (low)

**AI Valuation:**

```json
{
  "summary": "Limited market data (3 comps) suggests pricing around $95. Low sample size reduces confidence.",
  "fairValue": 95.0,
  "trend": "stable",
  "recommendation": "Monitor for more sales data. Consider waiting for better market visibility.",
  "confidence": 0.45
}
```

**Result:** ⚠️ Moderate confidence (limited data)

---

### Scenario 3: No Pricing Data

**Input:**

- Card: Custom Promo Card
- OCR confidence: 75%

**Pokémon TCG API Response:**

- 0 cards found

**Processing:**

- No data to normalize
- Fallback result returned

**Result:**

```json
{
  "valueLow": 0,
  "valueMedian": 0,
  "valueHigh": 0,
  "compsCount": 0,
  "sources": [],
  "confidence": 0,
  "message": "No pricing data available from any source"
}
```

**AI Valuation:**

```json
{
  "summary": "No market data available. Manual appraisal recommended.",
  "fairValue": 0,
  "trend": "stable",
  "recommendation": "Consult professional appraiser or check specialized forums.",
  "confidence": 0
}
```

**Result:** ❌ No data available

---

## Appendix B: Configuration Reference

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1

# Secrets Manager
TCGPLAYER_API_KEY_SECRET=collectiq-hackathon/tcgplayer-api-keys

# Bedrock Configuration
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
BEDROCK_MAX_TOKENS=2048
BEDROCK_TEMPERATURE=0.2

# Logging
LOG_LEVEL=INFO
```

### Rate Limits

```typescript
// Pokémon TCG API
const POKEMON_TCG_RATE_LIMIT = 20; // requests per minute

// Future sources
const EBAY_RATE_LIMIT = 5000; // requests per day
const TCGPLAYER_RATE_LIMIT = 300; // requests per minute
```

### Circuit Breaker Configuration

```typescript
const CIRCUIT_BREAKER_THRESHOLD = 5; // failures before opening
const CIRCUIT_BREAKER_TIMEOUT = 60000; // 60 seconds
```

### Retry Configuration

```typescript
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second
```

---

## Appendix C: Glossary

**Comparable (Comp):** A recent sale of the same or similar card used for pricing reference.

**Confidence Score:** A 0-1 metric indicating reliability of the pricing estimate based on sample size and variance.

**Circuit Breaker:** A design pattern that prevents repeated calls to a failing service.

**Coefficient of Variation (CV):** Standard deviation divided by mean, used to measure volatility.

**Fair Value:** AI-estimated market price considering all available data and trends.

**IQR (Interquartile Range):** Statistical method for detecting outliers (Q3 - Q1).

**Percentile:** A value below which a given percentage of observations fall (e.g., 50th percentile = median).

**Rate Limiting:** Restricting the number of API requests within a time window.

**Volatility:** Measure of price variation, calculated as coefficient of variation.

---

## Appendix D: References

### Academic Papers

1. **Outlier Detection:**
   - Tukey, J.W. (1977). "Exploratory Data Analysis"
   - Rousseeuw, P.J. & Hubert, M. (2011). "Robust Statistics for Outlier Detection"

2. **Price Prediction:**
   - Box, G.E.P. & Jenkins, G.M. (1970). "Time Series Analysis"
   - Hyndman, R.J. & Athanasopoulos, G. (2018). "Forecasting: Principles and Practice"

### API Documentation

- [Pokémon TCG API Documentation](https://pokemontcg.io/)
- [Amazon Bedrock Developer Guide](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)

### Related CollectIQ Documentation

- `AUTHENTICITY_AGENT_DOCUMENTATION.md` - Authenticity detection system
- `OCR_AGENT_FLOW_DOCUMENTATION.md` - OCR reasoning details
- `PRICING_CACHE_REMOVAL.md` - Cache removal rationale
- `docs/Backend/AI Agents.md` - Agent system overview

---

## Document Metadata

**Version:** 1.0  
**Last Updated:** October 22, 2025  
**Author:** CollectIQ Engineering Team  
**Status:** Production  
**Audience:** Developers, DevOps, Product Managers

**Change Log:**

- v1.0 (2025-10-22): Initial comprehensive documentation

---

**End of Document**
