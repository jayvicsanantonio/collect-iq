/**
 * Analytics and Feature Flags Usage Examples
 *
 * This file demonstrates how to use the analytics and feature flags
 * systems throughout the application.
 */

import analytics, {
  trackUploadStarted,
  trackUploadSucceeded,
  trackAnalyzeStarted,
  trackAnalyzeSucceeded,
  trackCardSaved,
  trackValuationRefreshed,
} from './analytics';
import featureFlags, {
  FeatureFlag,
  isPricingEnabled,
  isAuthenticityEnabled,
  areChartsEnabled,
  useFeatureFlag,
} from './feature-flags';

// ============================================================================
// ANALYTICS EXAMPLES
// ============================================================================

/**
 * Example: Track upload flow
 */
export function exampleUploadFlow() {
  // Track when upload starts
  const startTime = Date.now();
  trackUploadStarted({
    fileType: 'image/jpeg',
    fileSize: 2048000, // 2MB in bytes
  });

  // ... upload logic ...

  // Track when upload succeeds
  const duration = Date.now() - startTime;
  trackUploadSucceeded(duration, {
    fileType: 'image/jpeg',
  });
}

/**
 * Example: Track analysis flow with request ID
 */
export function exampleAnalysisFlow(requestId: string) {
  // Track when analysis starts
  trackAnalyzeStarted(requestId);

  const startTime = Date.now();

  // ... analysis logic ...

  // Track when analysis succeeds
  const duration = Date.now() - startTime;
  trackAnalyzeSucceeded(
    duration,
    {
      confidenceScore: 0.95,
      authenticityScore: 0.87,
      candidatesCount: 3,
    },
    requestId
  );
}

/**
 * Example: Track card saved
 */
export function exampleCardSaved() {
  trackCardSaved({
    set: 'Base Set',
    rarity: 'Rare Holo',
  });
}

/**
 * Example: Track valuation refresh
 */
export function exampleValuationRefresh() {
  const startTime = Date.now();

  // ... refresh logic ...

  const duration = Date.now() - startTime;
  trackValuationRefreshed(duration, {
    priceChange: 5.5, // percentage change
  });
}

/**
 * Example: Using the analytics class directly for custom events
 */
export function exampleCustomTracking() {
  // You can also use the analytics instance directly
  analytics.track(
    'upload_started',
    {
      fileType: 'image/png',
      source: 'camera', // Additional custom metadata
    },
    'req-123',
    undefined
  );
}

// ============================================================================
// FEATURE FLAGS EXAMPLES
// ============================================================================

/**
 * Example: Check if pricing is enabled
 */
export function examplePricingCheck() {
  if (isPricingEnabled()) {
    // Show pricing UI
    console.log('Pricing feature is enabled');
  } else {
    // Hide pricing UI
    console.log('Pricing feature is disabled');
  }
}

/**
 * Example: Check multiple flags
 */
export function exampleMultipleFlags() {
  if (
    featureFlags.areAllEnabled(
      FeatureFlag.PRICING_ENABLED,
      FeatureFlag.PRICING_HISTORICAL
    )
  ) {
    // Show historical pricing chart
    console.log('Historical pricing is available');
  }
}

/**
 * Example: Conditional rendering based on feature flag
 */
export function exampleConditionalFeature() {
  const showCharts = areChartsEnabled();
  const showAuthenticity = isAuthenticityEnabled();

  return {
    showCharts,
    showAuthenticity,
  };
}

/**
 * Example: React component using feature flags
 * Note: This is a conceptual example. In actual implementation,
 * this would be in a .tsx file with proper React imports.
 */
export function exampleReactComponent() {
  // Use the hook to check feature flags
  const chartsEnabled = useFeatureFlag(FeatureFlag.CHARTS_ENABLED);
  const authenticityEnabled = useFeatureFlag(FeatureFlag.AUTHENTICITY_ENABLED);

  // Return configuration object instead of JSX
  return {
    chartsEnabled,
    authenticityEnabled,
  };
}

/**
 * Example: Guard risky features behind flags
 */
export function exampleRiskyFeature() {
  // Only enable experimental features in development
  if (featureFlags.isEnabled(FeatureFlag.DEBUG_MODE)) {
    console.log('Debug mode enabled - showing experimental features');
    // Show experimental UI
  }
}

/**
 * Example: Get all enabled flags for debugging
 */
export function exampleDebugFlags() {
  const enabledFlags = featureFlags.getEnabledFlags();
  console.log('Enabled feature flags:', enabledFlags);
}

// ============================================================================
// INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: Complete upload flow with analytics and feature flags
 */
export async function exampleCompleteUploadFlow(_file: File) {
  // Track upload start
  const startTime = Date.now();
  trackUploadStarted({
    fileType: _file.type,
    fileSize: _file.size,
  });

  try {
    // Upload logic here
    await uploadFile();

    // Track success
    const duration = Date.now() - startTime;
    trackUploadSucceeded(duration, {
      fileType: _file.type,
    });

    // Start analysis if enabled
    if (isAuthenticityEnabled()) {
      const requestId = generateRequestId();
      trackAnalyzeStarted(requestId);
      // ... analysis logic
    }
  } catch (error) {
    console.error('Upload failed:', error);
    // Don't track failures to avoid noise in analytics
  }
}

/**
 * Example: Valuation panel with feature flags
 */
export function exampleValuationPanel() {
  const showHistoricalChart = featureFlags.areAllEnabled(
    FeatureFlag.PRICING_ENABLED,
    FeatureFlag.CHARTS_VALUATION_HISTORY
  );

  const showMultiSource = featureFlags.isEnabled(
    FeatureFlag.PRICING_MULTI_SOURCE
  );

  return {
    showHistoricalChart,
    showMultiSource,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function uploadFile(): Promise<void> {
  // Mock upload implementation
  return new Promise((resolve) => setTimeout(resolve, 1000));
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
