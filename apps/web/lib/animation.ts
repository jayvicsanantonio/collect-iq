/**
 * Animation Optimization Utilities
 * 
 * Provides utilities for creating performant animations that:
 * - Use CSS transforms and opacity (GPU-accelerated)
 * - Avoid expensive reflows and layout thrashing
 * - Respect reduced motion preferences
 * - Target 60fps performance
 * - Use will-change sparingly
 * 
 * @see https://web.dev/animations-guide/
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Animation durations in milliseconds
 * Based on design system tokens
 */
export const ANIMATION_DURATION = {
  fast: 150,
  base: 200,
  slow: 300,
} as const;

/**
 * Easing functions for smooth animations
 */
export const EASING = {
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ============================================================================
// Performance-Optimized Animation Classes
// ============================================================================

/**
 * Get optimized transition classes for transforms and opacity
 * These properties are GPU-accelerated and don't trigger reflows
 * 
 * @param duration - Animation duration ('fast' | 'base' | 'slow')
 * @param properties - CSS properties to animate (default: transform and opacity)
 * @returns Tailwind CSS classes for optimized transitions
 */
export function getOptimizedTransition(
  duration: keyof typeof ANIMATION_DURATION = 'base',
  properties: ('transform' | 'opacity' | 'all')[] = ['transform', 'opacity']
): string {
  const durationClass = {
    fast: 'duration-150',
    base: 'duration-200',
    slow: 'duration-300',
  }[duration];

  const propertyClass = properties.includes('all')
    ? 'transition-all'
    : properties.length === 1
    ? `transition-${properties[0]}`
    : 'transition-[transform,opacity]';

  return `${propertyClass} ${durationClass} ease-in-out`;
}

/**
 * Get fade animation classes (opacity only - GPU accelerated)
 */
export function getFadeTransition(duration: keyof typeof ANIMATION_DURATION = 'base'): string {
  return getOptimizedTransition(duration, ['opacity']);
}

/**
 * Get scale animation classes (transform only - GPU accelerated)
 */
export function getScaleTransition(duration: keyof typeof ANIMATION_DURATION = 'base'): string {
  return getOptimizedTransition(duration, ['transform']);
}

// ============================================================================
// Will-Change Management
// ============================================================================

/**
 * Safely apply will-change property
 * Only use during animation, remove after to avoid memory issues
 * 
 * @param element - DOM element to optimize
 * @param properties - CSS properties that will change
 * @param duration - How long the animation will last (ms)
 */
export function applyWillChange(
  element: HTMLElement,
  properties: string[],
  duration: number
): void {
  // Apply will-change before animation
  element.style.willChange = properties.join(', ');

  // Remove will-change after animation completes
  // Add extra 50ms buffer to ensure animation is complete
  setTimeout(() => {
    element.style.willChange = 'auto';
  }, duration + 50);
}

/**
 * React hook for managing will-change on an element
 * Automatically cleans up when component unmounts
 * 
 * @example
 * const ref = useWillChange(['transform', 'opacity'], 200);
 * return <div ref={ref}>Animated content</div>;
 */
export function useWillChange(
  properties: string[],
  duration: number
): (element: HTMLElement | null) => void {
  return (element: HTMLElement | null) => {
    if (!element) return;
    applyWillChange(element, properties, duration);
  };
}

// ============================================================================
// Throttling for Heavy Operations
// ============================================================================

/**
 * Throttle function to limit execution rate
 * Useful for scroll handlers, resize handlers, etc.
 * 
 * @param func - Function to throttle
 * @param limit - Minimum time between executions (ms)
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (this: unknown, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Request animation frame throttle
 * Ensures function runs at most once per frame (60fps)
 * 
 * @param func - Function to throttle
 * @returns Throttled function
 */
export function rafThrottle<T extends (...args: unknown[]) => unknown>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;

  return function (this: unknown, ...args: Parameters<T>): void {
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      func.apply(this, args);
      rafId = null;
    });
  };
}

// ============================================================================
// Layout Thrashing Prevention
// ============================================================================

/**
 * Batch DOM reads and writes to prevent layout thrashing
 * Reads happen first, then writes, avoiding forced reflows
 * 
 * @param reads - Array of read operations (e.g., getBoundingClientRect)
 * @param writes - Array of write operations (e.g., style changes)
 */
export function batchDOMOperations(
  reads: Array<() => unknown>,
  writes: Array<() => void>
): void {
  // Perform all reads first
  reads.forEach((read) => read());

  // Then perform all writes in next frame
  requestAnimationFrame(() => {
    writes.forEach((write) => write());
  });
}

/**
 * Measure element dimensions without causing layout thrashing
 * Uses ResizeObserver for efficient dimension tracking
 * 
 * @param element - Element to observe
 * @param callback - Called when dimensions change
 * @returns Cleanup function
 */
export function observeDimensions(
  element: HTMLElement,
  callback: (width: number, height: number) => void
): () => void {
  const observer = new ResizeObserver((entries) => {
    // Use requestAnimationFrame to batch updates
    requestAnimationFrame(() => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        callback(width, height);
      }
    });
  });

  observer.observe(element);

  return () => observer.disconnect();
}

// ============================================================================
// Reduced Motion Support
// ============================================================================

/**
 * Check if user prefers reduced motion
 * @returns true if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get animation duration respecting reduced motion preference
 * Returns 0 if reduced motion is preferred
 * 
 * @param duration - Desired duration in milliseconds
 * @returns Duration (0 if reduced motion preferred)
 */
export function getAnimationDuration(duration: number): number {
  return prefersReducedMotion() ? 0 : duration;
}

/**
 * Get transition class respecting reduced motion preference
 * Returns empty string if reduced motion is preferred
 * 
 * @param transitionClass - Tailwind transition class
 * @returns Transition class or empty string
 */
export function getTransitionClass(transitionClass: string): string {
  return prefersReducedMotion() ? '' : transitionClass;
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Measure animation performance
 * Logs warning if animation drops below 60fps
 * 
 * @param name - Animation name for logging
 * @param callback - Animation function to measure
 */
export function measureAnimationPerformance(
  name: string,
  callback: () => void
): void {
  if (typeof window === 'undefined') return;

  const startTime = performance.now();
  let frameCount = 0;

  const measureFrame = () => {
    frameCount++;
    const elapsed = performance.now() - startTime;

    // Measure for 1 second
    if (elapsed < 1000) {
      requestAnimationFrame(measureFrame);
    } else {
      const fps = frameCount / (elapsed / 1000);

      if (fps < 55) {
        console.warn(
          `Animation "${name}" running at ${fps.toFixed(1)}fps (target: 60fps)`
        );
      }
    }
  };

  callback();
  requestAnimationFrame(measureFrame);
}

// ============================================================================
// Optimized Animation Patterns
// ============================================================================

/**
 * Create a stagger animation effect
 * Animates items in sequence with a delay between each
 * 
 * @param items - Array of elements to animate
 * @param staggerDelay - Delay between each item (ms)
 * @param animationClass - CSS class to add for animation
 */
export function staggerAnimation(
  items: HTMLElement[],
  staggerDelay: number,
  animationClass: string
): void {
  if (prefersReducedMotion()) {
    // Apply all animations immediately if reduced motion
    items.forEach((item) => item.classList.add(animationClass));
    return;
  }

  items.forEach((item, index) => {
    setTimeout(() => {
      item.classList.add(animationClass);
    }, index * staggerDelay);
  });
}

/**
 * Parallax scroll effect with performance optimization
 * Uses transform for GPU acceleration and RAF throttling
 * 
 * @param element - Element to apply parallax to
 * @param speed - Parallax speed (0-1, where 0.5 is half speed)
 * @returns Cleanup function
 */
export function createParallaxEffect(
  element: HTMLElement,
  speed: number = 0.5
): () => void {
  if (prefersReducedMotion()) {
    return () => {}; // No-op if reduced motion
  }

  const handleScroll = rafThrottle(() => {
    const scrollY = window.scrollY;
    const offset = scrollY * speed;
    
    // Use transform for GPU acceleration
    element.style.transform = `translate3d(0, ${offset}px, 0)`;
  });

  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => {
    window.removeEventListener('scroll', handleScroll);
    element.style.transform = '';
  };
}

// ============================================================================
// CSS-in-JS Helpers
// ============================================================================

/**
 * Generate optimized keyframe animation CSS
 * Uses transform and opacity for GPU acceleration
 * 
 * @param name - Animation name
 * @param keyframes - Keyframe definitions
 * @returns CSS string
 */
export function createKeyframeAnimation(
  name: string,
  keyframes: Record<string, Record<string, string>>
): string {
  const keyframeStrings = Object.entries(keyframes)
    .map(([key, styles]) => {
      const styleStrings = Object.entries(styles)
        .map(([prop, value]) => `${prop}: ${value};`)
        .join(' ');
      return `${key} { ${styleStrings} }`;
    })
    .join(' ');

  return `@keyframes ${name} { ${keyframeStrings} }`;
}

/**
 * Common optimized animations
 */
export const OPTIMIZED_ANIMATIONS = {
  fadeIn: 'animate-in fade-in duration-200',
  fadeOut: 'animate-out fade-out duration-200',
  slideInFromBottom: 'animate-in slide-in-from-bottom duration-300',
  slideOutToBottom: 'animate-out slide-out-to-bottom duration-300',
  scaleIn: 'animate-in zoom-in-95 duration-200',
  scaleOut: 'animate-out zoom-out-95 duration-200',
} as const;
