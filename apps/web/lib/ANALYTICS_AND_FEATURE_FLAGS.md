# Analytics and Feature Flags

This document describes the analytics and feature flags systems implemented for CollectIQ.

## Table of Contents

- [Analytics System](#analytics-system)
- [Feature Flags System](#feature-flags-system)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Privacy and Compliance](#privacy-and-compliance)

## Analytics System

The analytics system provides privacy-first event tracking with the following features:

### Key Features

- **Privacy-First**: Never includes PII (Personally Identifiable Information)
- **DNT Respect**: Automatically respects Do Not Track browser setting
- **Event Batching**: Batches events for performance (10 events or 5 seconds)
- **Request Tracing**: Includes requestId for traceability
- **Reliable Delivery**: Uses `navigator.sendBeacon` for reliability during page unload
- **Environment-Based**: Can be disabled via environment variables

### Tracked Events

The system tracks the following events:

1. **upload_started**: When a user starts uploading a card image
2. **upload_succeeded**: When an upload completes successfully
3. **analyze_started**: When card analysis begins
4. **analyze_succeeded**: When analysis completes successfully
5. **card_saved**: When a card is saved to the vault
6. **valuation_refreshed**: When valuation data is refreshed

### Event Structure

Each event includes:

```typescript
{
  id: string;              // Unique event ID
  event: AnalyticsEvent;   // Event type
  timestamp: string;       // ISO 8601 timestamp
  requestId?: string;      // Optional request ID for traceability
  metadata?: Record<...>;  // Additional context (no PII)
  duration?: number;       // Optional duration in milliseconds
}
```

### Usage

```typescript
import {
  trackUploadStarted,
  trackUploadSucceeded,
  trackAnalyzeStarted,
  trackAnalyzeSucceeded,
  trackCardSaved,
  trackValuationRefreshed,
} from '@/lib/analytics';

// Track upload start
trackUploadStarted({
  fileType: 'image/jpeg',
  fileSize: 2048000,
});

// Track upload success with duration
const duration = Date.now() - startTime;
trackUploadSucceeded(duration, {
  fileType: 'image/jpeg',
});

// Track analysis with request ID
trackAnalyzeStarted('req-123');
trackAnalyzeSucceeded(
  duration,
  {
    confidenceScore: 0.95,
    authenticityScore: 0.87,
    candidatesCount: 3,
  },
  'req-123'
);
```

### PII Protection

The system automatically validates that metadata doesn't contain PII. The following keys are blocked:

- email
- name
- phone
- address
- ssn
- userId
- username
- ip
- location
- sub

If PII is detected, the event is not tracked and an error is logged.

## Feature Flags System

The feature flags system allows toggling features on/off based on environment configuration.

### Available Flags

#### Pricing Features
- `pricing`: Enable pricing features
- `pricing_multi_source`: Enable multi-source pricing
- `pricing_historical`: Enable historical pricing data

#### Authenticity Features
- `authenticity`: Enable authenticity analysis
- `authenticity_detailed_breakdown`: Enable detailed breakdown
- `authenticity_feedback`: Enable feedback reporting

#### Chart Features
- `charts`: Enable charts
- `charts_valuation_history`: Enable valuation history chart
- `charts_portfolio_sparkline`: Enable portfolio sparkline

#### Upload Features
- `camera_capture`: Enable camera capture
- `image_compression`: Enable image compression

#### Vault Features
- `vault_filters`: Enable vault filters
- `vault_virtualization`: Enable virtualization for large collections
- `vault_bulk_operations`: Enable bulk operations

#### Debug Features
- `debug`: Enable debug mode
- `analytics_debug`: Enable analytics debugging

### Usage

#### Basic Usage

```typescript
import featureFlags, { FeatureFlag } from '@/lib/feature-flags';

// Check if a feature is enabled
if (featureFlags.isEnabled(FeatureFlag.PRICING_ENABLED)) {
  // Show pricing UI
}

// Check if all flags are enabled
if (
  featureFlags.areAllEnabled(
    FeatureFlag.PRICING_ENABLED,
    FeatureFlag.PRICING_HISTORICAL
  )
) {
  // Show historical pricing
}

// Check if any flag is enabled
if (
  featureFlags.isAnyEnabled(
    FeatureFlag.CHARTS_ENABLED,
    FeatureFlag.PRICING_ENABLED
  )
) {
  // Show data visualization
}
```

#### Convenience Functions

```typescript
import {
  isPricingEnabled,
  isAuthenticityEnabled,
  areChartsEnabled,
  isCameraCaptureEnabled,
  areVaultFiltersEnabled,
  isDebugMode,
} from '@/lib/feature-flags';

if (isPricingEnabled()) {
  // Show pricing
}

if (areChartsEnabled()) {
  // Show charts
}
```

#### React Hooks

```typescript
import { useFeatureFlag, FeatureFlag } from '@/lib/feature-flags';

function MyComponent() {
  const chartsEnabled = useFeatureFlag(FeatureFlag.CHARTS_ENABLED);
  const pricingEnabled = useFeatureFlag(FeatureFlag.PRICING_ENABLED);

  return (
    <div>
      {chartsEnabled && <ChartsComponent />}
      {pricingEnabled && <PricingComponent />}
    </div>
  );
}
```

## Configuration

### Environment Variables

Add to `.env.local`:

```bash
# Enable analytics (set to any value to enable)
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id

# Enable feature flags (comma-separated)
FEATURE_FLAGS=pricing,authenticity,charts,camera_capture,vault_filters
```

### Example Configurations

#### Development (All Features)
```bash
FEATURE_FLAGS=pricing,pricing_multi_source,pricing_historical,authenticity,authenticity_detailed_breakdown,authenticity_feedback,charts,charts_valuation_history,charts_portfolio_sparkline,camera_capture,image_compression,vault_filters,vault_virtualization,debug,analytics_debug
```

#### Production (Stable Features Only)
```bash
FEATURE_FLAGS=pricing,authenticity,charts,camera_capture,vault_filters
```

#### Minimal (Core Features)
```bash
FEATURE_FLAGS=pricing,authenticity
```

## Usage Examples

### Complete Upload Flow

```typescript
import {
  trackUploadStarted,
  trackUploadSucceeded,
  trackAnalyzeStarted,
} from '@/lib/analytics';
import { isCameraCaptureEnabled } from '@/lib/feature-flags';

async function handleUpload(file: File) {
  // Check if camera is enabled
  const cameraEnabled = isCameraCaptureEnabled();

  // Track upload start
  const startTime = Date.now();
  trackUploadStarted({
    fileType: file.type,
    fileSize: file.size,
  });

  try {
    // Upload file
    await uploadFile(file);

    // Track success
    const duration = Date.now() - startTime;
    trackUploadSucceeded(duration, {
      fileType: file.type,
    });

    // Start analysis
    const requestId = generateRequestId();
    trackAnalyzeStarted(requestId);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

### Conditional Feature Rendering

```typescript
import { useFeatureFlag, FeatureFlag } from '@/lib/feature-flags';

function ValuationPanel() {
  const showHistoricalChart = useFeatureFlag(
    FeatureFlag.CHARTS_VALUATION_HISTORY
  );
  const showMultiSource = useFeatureFlag(FeatureFlag.PRICING_MULTI_SOURCE);

  return (
    <div>
      <CurrentValuation />
      {showMultiSource && <MultiSourcePricing />}
      {showHistoricalChart && <HistoricalChart />}
    </div>
  );
}
```

### Debug Mode

```typescript
import { isDebugMode } from '@/lib/feature-flags';

function DebugPanel() {
  if (!isDebugMode()) {
    return null;
  }

  return (
    <div className="fixed bottom-0 right-0 p-4 bg-black text-white">
      <h3>Debug Info</h3>
      {/* Debug information */}
    </div>
  );
}
```

## Privacy and Compliance

### Do Not Track (DNT)

The analytics system automatically respects the Do Not Track browser setting. When DNT is enabled:

- No events are tracked
- No data is sent to analytics endpoints
- A console message confirms analytics is disabled

### GDPR Compliance

The system is designed to be GDPR-compliant:

- **No PII**: Never collects personally identifiable information
- **Consent**: Can be disabled via environment variables
- **Transparency**: All tracked events are documented
- **Data Minimization**: Only collects necessary data
- **Right to Object**: Respects DNT header

### PII Detection

The system includes basic PII detection that blocks events containing:

- Email addresses
- Names
- Phone numbers
- Addresses
- Social security numbers
- User IDs
- IP addresses
- Location data

### Best Practices

1. **Never include PII in metadata**
   ```typescript
   // ❌ Bad - includes PII
   trackCardSaved({
     userId: 'user-123',
     email: 'user@example.com',
   });

   // ✅ Good - no PII
   trackCardSaved({
     set: 'Base Set',
     rarity: 'Rare Holo',
   });
   ```

2. **Use requestId for tracing**
   ```typescript
   // ✅ Good - use requestId instead of userId
   trackAnalyzeStarted('req-abc-123');
   ```

3. **Aggregate data only**
   ```typescript
   // ✅ Good - aggregate metrics
   trackAnalyzeSucceeded(duration, {
     confidenceScore: 0.95,
     candidatesCount: 3,
   });
   ```

## Testing

### Disable Analytics in Tests

```typescript
// In test setup
process.env.NEXT_PUBLIC_ANALYTICS_ID = '';
```

### Override Feature Flags in Tests

```typescript
import featureFlags, { FeatureFlag } from '@/lib/feature-flags';

// Override a flag
featureFlags.override(FeatureFlag.PRICING_ENABLED, true);

// Clear cache after test
afterEach(() => {
  featureFlags.clearCache();
});
```

## Troubleshooting

### Analytics Not Working

1. Check if `NEXT_PUBLIC_ANALYTICS_ID` is set
2. Check if DNT is enabled in browser
3. Check browser console for error messages
4. Verify API endpoint is accessible

### Feature Flags Not Working

1. Check if `FEATURE_FLAGS` environment variable is set
2. Verify flag names are correct (case-sensitive)
3. Clear feature flag cache: `featureFlags.clearCache()`
4. Check for typos in flag names

### Events Not Batching

Events are batched when:
- Queue reaches 10 events, OR
- 5 seconds have passed since last flush

To force immediate flush (for testing):
```typescript
import analytics from '@/lib/analytics';
analytics['flush'](); // Access private method for testing
```

## Future Enhancements

- [ ] Add A/B testing support
- [ ] Add user segmentation
- [ ] Add funnel analysis
- [ ] Add real-time analytics dashboard
- [ ] Add custom event types
- [ ] Add event replay for debugging
- [ ] Add analytics middleware for automatic tracking
- [ ] Add feature flag UI for runtime toggling
