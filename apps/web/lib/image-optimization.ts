/**
 * Image Optimization Utilities
 * Helpers for Next.js Image component optimization
 */

/**
 * Generate blur data URL for placeholder
 * This is a minimal 1x1 gray pixel for consistent loading states
 */
export const BLUR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

/**
 * Card aspect ratio constant
 * Standard trading card dimensions (2.5" x 3.5")
 */
export const CARD_ASPECT_RATIO = 2.5 / 3.5;

/**
 * Get responsive sizes attribute for card images based on viewport
 * @param context - Where the image is being used
 * @returns sizes attribute string for Next.js Image
 */
export function getCardImageSizes(
  context: 'thumbnail' | 'detail' | 'candidate'
): string {
  switch (context) {
    case 'thumbnail':
      // Vault grid: 1 col mobile, 2 col tablet, 3 col desktop, 4 col large
      return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw';
    case 'detail':
      // Detail view: full width on mobile, constrained on desktop
      return '(max-width: 768px) 100vw, (max-width: 1024px) 80vw, 600px';
    case 'candidate':
      // Small fixed size thumbnail
      return '64px';
    default:
      return '100vw';
  }
}

/**
 * Get image URL from S3 key
 * In production, this would return a CloudFront URL or S3 presigned URL
 * @param s3Key - S3 object key
 * @returns Image URL
 */
export function getImageUrlFromS3Key(s3Key: string): string {
  // TODO: Replace with actual CloudFront distribution URL
  // For now, use API route pattern
  return `/api/images/${s3Key}`;
}

/**
 * Get card image URL from card ID
 * @param cardId - Card identifier
 * @returns Image URL
 */
export function getCardImageUrl(cardId: string): string {
  return `/api/cards/${cardId}/image`;
}

/**
 * Image loader configuration for Next.js Image component
 * Can be customized for CDN optimization
 */
export interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

/**
 * Custom image loader for CDN optimization
 * @param props - Loader properties
 * @returns Optimized image URL
 */
export function customImageLoader({
  src,
  width,
  quality = 75,
}: ImageLoaderProps): string {
  // For external URLs (S3, CloudFront), pass through
  if (src.startsWith('http')) {
    return src;
  }

  // For local API routes, add width and quality params
  const url = new URL(src, 'http://localhost');
  url.searchParams.set('w', width.toString());
  url.searchParams.set('q', quality.toString());

  return url.pathname + url.search;
}

/**
 * Priority loading configuration
 * Determines which images should be loaded with priority
 */
export function shouldPrioritizeImage(
  context: 'above-fold' | 'below-fold' | 'lazy'
): boolean {
  return context === 'above-fold';
}

/**
 * Get optimal image quality based on context
 * @param context - Image usage context
 * @returns Quality value (1-100)
 */
export function getImageQuality(
  context: 'thumbnail' | 'detail' | 'preview'
): number {
  switch (context) {
    case 'thumbnail':
      return 75; // Good balance for grid views
    case 'detail':
      return 90; // High quality for detail views
    case 'preview':
      return 60; // Lower quality for quick previews
    default:
      return 75;
  }
}
