/**
 * Feature Flags System
 *
 * Allows toggling features on/off based on environment configuration.
 * Useful for:
 * - Gradual rollouts
 * - A/B testing
 * - Disabling risky features in production
 * - Environment-specific features
 */

import { isFeatureEnabled } from './env';

// Define all available feature flags
export enum FeatureFlag {
  // Pricing features
  PRICING_ENABLED = 'pricing',
  PRICING_MULTI_SOURCE = 'pricing_multi_source',
  PRICING_HISTORICAL = 'pricing_historical',

  // Authenticity features
  AUTHENTICITY_ENABLED = 'authenticity',
  AUTHENTICITY_DETAILED_BREAKDOWN = 'authenticity_detailed_breakdown',
  AUTHENTICITY_FEEDBACK = 'authenticity_feedback',

  // Chart features
  CHARTS_ENABLED = 'charts',
  CHARTS_VALUATION_HISTORY = 'charts_valuation_history',
  CHARTS_PORTFOLIO_SPARKLINE = 'charts_portfolio_sparkline',

  // Upload features
  CAMERA_CAPTURE = 'camera_capture',
  IMAGE_COMPRESSION = 'image_compression',

  // Vault features
  VAULT_FILTERS = 'vault_filters',
  VAULT_VIRTUALIZATION = 'vault_virtualization',
  VAULT_BULK_OPERATIONS = 'vault_bulk_operations',

  // Social features (future)
  SOCIAL_SHARING = 'social_sharing',
  SOCIAL_COLLECTIONS = 'social_collections',

  // Performance features
  LAZY_LOADING = 'lazy_loading',
  PREFETCHING = 'prefetching',

  // Debug features
  DEBUG_MODE = 'debug',
  ANALYTICS_DEBUG = 'analytics_debug',
}

class FeatureFlagManager {
  private cache: Map<FeatureFlag, boolean> = new Map();

  /**
   * Check if a feature flag is enabled
   * @param flag - Feature flag to check
   * @returns true if enabled, false otherwise
   */
  isEnabled(flag: FeatureFlag): boolean {
    // Check cache first
    if (this.cache.has(flag)) {
      return this.cache.get(flag)!;
    }

    // Check environment variable
    const enabled = isFeatureEnabled(flag);

    // Cache result
    this.cache.set(flag, enabled);

    return enabled;
  }

  /**
   * Check if multiple flags are all enabled
   * @param flags - Array of feature flags
   * @returns true if all flags are enabled
   */
  areAllEnabled(...flags: FeatureFlag[]): boolean {
    return flags.every((flag) => this.isEnabled(flag));
  }

  /**
   * Check if any of the flags are enabled
   * @param flags - Array of feature flags
   * @returns true if any flag is enabled
   */
  isAnyEnabled(...flags: FeatureFlag[]): boolean {
    return flags.some((flag) => this.isEnabled(flag));
  }

  /**
   * Get all enabled flags
   * @returns Array of enabled feature flags
   */
  getEnabledFlags(): FeatureFlag[] {
    return Object.values(FeatureFlag).filter((flag) => this.isEnabled(flag));
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Override a flag (useful for testing)
   * @param flag - Feature flag to override
   * @param enabled - Whether the flag should be enabled
   */
  override(flag: FeatureFlag, enabled: boolean): void {
    this.cache.set(flag, enabled);
  }
}

// Singleton instance
const featureFlags = new FeatureFlagManager();

export default featureFlags;

// Export convenience functions for common checks
export const isPricingEnabled = () =>
  featureFlags.isEnabled(FeatureFlag.PRICING_ENABLED);

export const isAuthenticityEnabled = () =>
  featureFlags.isEnabled(FeatureFlag.AUTHENTICITY_ENABLED);

export const areChartsEnabled = () =>
  featureFlags.isEnabled(FeatureFlag.CHARTS_ENABLED);

export const isCameraCaptureEnabled = () =>
  featureFlags.isEnabled(FeatureFlag.CAMERA_CAPTURE);

export const areVaultFiltersEnabled = () =>
  featureFlags.isEnabled(FeatureFlag.VAULT_FILTERS);

export const isDebugMode = () =>
  featureFlags.isEnabled(FeatureFlag.DEBUG_MODE);

// React hook for feature flags
import { useMemo } from 'react';

export function useFeatureFlag(flag: FeatureFlag): boolean {
  return useMemo(() => featureFlags.isEnabled(flag), [flag]);
}

export function useFeatureFlags(...flags: FeatureFlag[]): boolean[] {
  return useMemo(
    () => flags.map((flag) => featureFlags.isEnabled(flag)),
    [flags]
  );
}
