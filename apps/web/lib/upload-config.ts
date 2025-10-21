/**
 * Upload configuration with environment variable support
 */

export const UPLOAD_CONFIG = {
  maxSizeMB: Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 12,
  maxSizeBytes: (Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 12) * 1024 * 1024,
  supportedFormats: ['image/jpeg', 'image/png', 'image/heic', 'image/heif'] as const,
  supportedExtensions: ['.jpg', '.jpeg', '.png', '.heic', '.heif'] as const,
  minDimensionPx: 1200,
  optimalDimensionRange: [2000, 4000] as const,
} as const;

export type UploadConfig = typeof UPLOAD_CONFIG;
