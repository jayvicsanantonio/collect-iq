import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ImageCache {
  url: string;
  expiresAt: number;
}

// In-memory cache for presigned URLs
const imageCache = new Map<string, ImageCache>();

/**
 * Hook to fetch and cache presigned URLs for card images
 * Automatically refreshes URLs before they expire
 */
export function useCardImage(s3Key: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!s3Key) {
      setImageUrl(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchImageUrl = async () => {
      try {
        // Check cache first
        const cached = imageCache.get(s3Key);
        const now = Date.now();

        // Use cached URL if it's still valid (with 5 minute buffer)
        if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
          if (isMounted) {
            setImageUrl(cached.url);
            setIsLoading(false);
          }
          return;
        }

        // Fetch new presigned URL
        const response = await api.getImagePresignedUrl(s3Key);

        // Cache the URL with expiration time
        const expiresAt = now + response.expiresIn * 1000;
        imageCache.set(s3Key, {
          url: response.viewUrl,
          expiresAt,
        });

        if (isMounted) {
          setImageUrl(response.viewUrl);
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch image URL:', err);
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load image'));
          setIsLoading(false);
        }
      }
    };

    fetchImageUrl();

    return () => {
      isMounted = false;
    };
  }, [s3Key]);

  return { imageUrl, isLoading, error };
}
