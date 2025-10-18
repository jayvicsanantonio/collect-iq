/**
 * HTTP cache headers utilities for API routes
 * Implements standard HTTP caching strategies
 */

// ============================================================================
// Types
// ============================================================================

export interface CacheOptions {
  /**
   * Maximum age in seconds for the cached response
   */
  maxAge?: number;
  
  /**
   * Stale-while-revalidate window in seconds
   */
  staleWhileRevalidate?: number;
  
  /**
   * Whether the response can be cached by shared caches (CDN, proxy)
   */
  public?: boolean;
  
  /**
   * Whether the response must be revalidated with the server
   */
  mustRevalidate?: boolean;
  
  /**
   * Whether to prevent caching entirely
   */
  noCache?: boolean;
  
  /**
   * Whether to prevent storing the response
   */
  noStore?: boolean;
}

// ============================================================================
// Cache Header Presets
// ============================================================================

/**
 * Preset cache configurations for common use cases
 */
export const CACHE_PRESETS = {
  /**
   * No caching - always fetch fresh data
   * Use for: Authentication endpoints, mutations
   */
  NO_CACHE: {
    noStore: true,
    noCache: true,
  } as CacheOptions,
  
  /**
   * Short cache with stale-while-revalidate
   * Use for: Vault lists, frequently updated data
   */
  SHORT_CACHE: {
    maxAge: 60, // 1 minute
    staleWhileRevalidate: 300, // 5 minutes
    public: false,
  } as CacheOptions,
  
  /**
   * Medium cache with stale-while-revalidate
   * Use for: Card details, less frequently updated data
   */
  MEDIUM_CACHE: {
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 600, // 10 minutes
    public: false,
  } as CacheOptions,
  
  /**
   * Long cache with stale-while-revalidate
   * Use for: Valuation data, expensive computations
   */
  LONG_CACHE: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 7200, // 2 hours
    public: false,
  } as CacheOptions,
  
  /**
   * Static asset cache
   * Use for: Images, fonts, static files
   */
  STATIC_CACHE: {
    maxAge: 31536000, // 1 year
    public: true,
    mustRevalidate: false,
  } as CacheOptions,
} as const;

// ============================================================================
// Cache Header Generation
// ============================================================================

/**
 * Generate Cache-Control header value from options
 * 
 * @param options - Cache configuration options
 * @returns Cache-Control header value
 * 
 * @example
 * ```ts
 * const cacheControl = getCacheControlHeader(CACHE_PRESETS.SHORT_CACHE);
 * // Returns: "private, max-age=60, stale-while-revalidate=300"
 * ```
 */
export function getCacheControlHeader(options: CacheOptions): string {
  const directives: string[] = [];
  
  // No caching directives
  if (options.noStore) {
    directives.push('no-store');
  }
  
  if (options.noCache) {
    directives.push('no-cache');
  }
  
  // If no-store or no-cache, return early
  if (options.noStore || options.noCache) {
    return directives.join(', ');
  }
  
  // Public/private directive
  if (options.public) {
    directives.push('public');
  } else {
    directives.push('private');
  }
  
  // Max-age directive
  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }
  
  // Stale-while-revalidate directive
  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }
  
  // Must-revalidate directive
  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }
  
  return directives.join(', ');
}

/**
 * Set cache headers on a Response object
 * 
 * @param response - Response object to modify
 * @param options - Cache configuration options
 * @returns Modified Response object
 * 
 * @example
 * ```ts
 * const response = new Response(JSON.stringify(data));
 * return setCacheHeaders(response, CACHE_PRESETS.MEDIUM_CACHE);
 * ```
 */
export function setCacheHeaders(
  response: Response,
  options: CacheOptions
): Response {
  const cacheControl = getCacheControlHeader(options);
  response.headers.set('Cache-Control', cacheControl);
  
  // Add Vary header for content negotiation
  if (!response.headers.has('Vary')) {
    response.headers.set('Vary', 'Accept-Encoding');
  }
  
  return response;
}

/**
 * Create a new Response with cache headers
 * 
 * @param body - Response body
 * @param options - Cache configuration options
 * @param init - Additional Response init options
 * @returns Response with cache headers
 * 
 * @example
 * ```ts
 * return createCachedResponse(
 *   JSON.stringify(data),
 *   CACHE_PRESETS.SHORT_CACHE,
 *   { status: 200, headers: { 'Content-Type': 'application/json' } }
 * );
 * ```
 */
export function createCachedResponse(
  body: BodyInit | null,
  options: CacheOptions,
  init?: ResponseInit
): Response {
  const response = new Response(body, init);
  return setCacheHeaders(response, options);
}

// ============================================================================
// Next.js Route Handler Helpers
// ============================================================================

/**
 * Create headers object for Next.js route handlers
 * 
 * @param options - Cache configuration options
 * @returns Headers object with cache directives
 * 
 * @example
 * ```ts
 * export async function GET() {
 *   const data = await fetchData();
 *   return Response.json(data, {
 *     headers: getCacheHeaders(CACHE_PRESETS.MEDIUM_CACHE)
 *   });
 * }
 * ```
 */
export function getCacheHeaders(options: CacheOptions): Record<string, string> {
  return {
    'Cache-Control': getCacheControlHeader(options),
    'Vary': 'Accept-Encoding',
  };
}

/**
 * Create a JSON response with cache headers for Next.js route handlers
 * 
 * @param data - Data to serialize as JSON
 * @param options - Cache configuration options
 * @param init - Additional Response init options
 * @returns JSON Response with cache headers
 * 
 * @example
 * ```ts
 * export async function GET() {
 *   const data = await fetchData();
 *   return jsonWithCache(data, CACHE_PRESETS.MEDIUM_CACHE);
 * }
 * ```
 */
export function jsonWithCache<T>(
  data: T,
  options: CacheOptions,
  init?: ResponseInit
): Response {
  return Response.json(data, {
    ...init,
    headers: {
      ...getCacheHeaders(options),
      ...(init?.headers || {}),
    },
  });
}

// ============================================================================
// Cache Validation Helpers
// ============================================================================

/**
 * Check if a cached response is still fresh
 * 
 * @param cachedAt - Timestamp when the response was cached
 * @param maxAge - Maximum age in seconds
 * @returns True if the cached response is still fresh
 */
export function isCacheFresh(cachedAt: number, maxAge: number): boolean {
  const now = Date.now();
  const age = (now - cachedAt) / 1000; // Convert to seconds
  return age < maxAge;
}

/**
 * Check if a cached response is stale but can be revalidated
 * 
 * @param cachedAt - Timestamp when the response was cached
 * @param maxAge - Maximum age in seconds
 * @param staleWhileRevalidate - Stale-while-revalidate window in seconds
 * @returns True if the cached response is stale but within revalidation window
 */
export function isStaleButRevalidatable(
  cachedAt: number,
  maxAge: number,
  staleWhileRevalidate: number
): boolean {
  const now = Date.now();
  const age = (now - cachedAt) / 1000; // Convert to seconds
  return age >= maxAge && age < maxAge + staleWhileRevalidate;
}

/**
 * Get cache age in seconds
 * 
 * @param cachedAt - Timestamp when the response was cached
 * @returns Age in seconds
 */
export function getCacheAge(cachedAt: number): number {
  const now = Date.now();
  return Math.floor((now - cachedAt) / 1000);
}
