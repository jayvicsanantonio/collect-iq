import { useEffect, useState } from 'react';

/**
 * Hook to detect if user prefers reduced motion
 * Respects the prefers-reduced-motion media query
 *
 * @returns boolean indicating if reduced motion is preferred
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check if window is available (client-side only)
    if (typeof window === 'undefined') {
      return;
    }

    // Create media query
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches);

    // Listen for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    // Add listener (use deprecated addListener for older browsers)
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Get animation duration based on reduced motion preference
 * Returns 0 if reduced motion is preferred, otherwise returns the specified duration
 *
 * @param duration - Animation duration in milliseconds
 * @param prefersReducedMotion - Whether reduced motion is preferred
 * @returns Duration in milliseconds (0 if reduced motion)
 */
export function getAnimationDuration(
  duration: number,
  prefersReducedMotion: boolean
): number {
  return prefersReducedMotion ? 0 : duration;
}

/**
 * Get transition class based on reduced motion preference
 * Returns instant transition if reduced motion is preferred
 *
 * @param transitionClass - Tailwind transition class (e.g., 'transition-all duration-200')
 * @param prefersReducedMotion - Whether reduced motion is preferred
 * @returns Transition class or empty string
 */
export function getTransitionClass(
  transitionClass: string,
  prefersReducedMotion: boolean
): string {
  return prefersReducedMotion ? '' : transitionClass;
}
