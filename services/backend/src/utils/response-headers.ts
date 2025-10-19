/**
 * Response Headers Utility
 *
 * Provides consistent security headers for all API responses.
 * Implements security best practices including HSTS, content type protection,
 * and XSS prevention.
 */

export interface SecurityHeaders {
  'Content-Type': string;
  'Strict-Transport-Security': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Content-Security-Policy': string;
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Credentials': string;
  'Cache-Control'?: string;
  [key: string]: string | undefined;
}

/**
 * Get standard security headers for API responses
 *
 * @param contentType - Content type for the response (default: application/json)
 * @param additionalHeaders - Additional headers to merge
 * @param origin - Request origin for CORS (optional, will use default if not provided)
 * @returns Object containing security headers
 */
export function getSecurityHeaders(
  contentType: string = 'application/json',
  additionalHeaders: Record<string, string> = {},
  origin?: string
): SecurityHeaders {
  // Determine CORS origin - use request origin if it's in allowed list
  const allowedOrigins = ['https://main.ddtufp5of4bf.amplifyapp.com', 'http://localhost:3000'];
  const corsOrigin =
    origin && allowedOrigins.includes(origin) ? origin : 'https://main.ddtufp5of4bf.amplifyapp.com';

  const baseHeaders: SecurityHeaders = {
    'Content-Type': contentType,
    // HSTS: Force HTTPS for 1 year including subdomains
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',
    // Content Security Policy
    'Content-Security-Policy': "default-src 'self'",
    // CORS headers - dynamically set based on request origin
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
  };

  return {
    ...baseHeaders,
    ...additionalHeaders,
  };
}

/**
 * Get headers for JSON API responses
 *
 * @param additionalHeaders - Additional headers to merge
 * @param origin - Request origin for CORS (optional)
 * @returns Object containing security headers for JSON responses
 */
export function getJsonHeaders(
  additionalHeaders: Record<string, string> = {},
  origin?: string
): SecurityHeaders {
  return getSecurityHeaders('application/json', additionalHeaders, origin);
}

/**
 * Get headers for problem+json error responses (RFC 7807)
 *
 * @param additionalHeaders - Additional headers to merge
 * @param origin - Request origin for CORS (optional)
 * @returns Object containing security headers for problem+json responses
 */
export function getProblemJsonHeaders(
  additionalHeaders: Record<string, string> = {},
  origin?: string
): SecurityHeaders {
  return getSecurityHeaders('application/problem+json', additionalHeaders, origin);
}

/**
 * Get headers for responses that should not be cached
 *
 * @param contentType - Content type for the response
 * @param additionalHeaders - Additional headers to merge
 * @param origin - Request origin for CORS (optional)
 * @returns Object containing security headers with no-cache directives
 */
export function getNoCacheHeaders(
  contentType: string = 'application/json',
  additionalHeaders: Record<string, string> = {},
  origin?: string
): SecurityHeaders {
  return getSecurityHeaders(
    contentType,
    {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...additionalHeaders,
    },
    origin
  );
}
