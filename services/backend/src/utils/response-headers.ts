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
  'Cache-Control'?: string;
  [key: string]: string | undefined;
}

/**
 * Get standard security headers for API responses
 *
 * @param contentType - Content type for the response (default: application/json)
 * @param additionalHeaders - Additional headers to merge
 * @returns Object containing security headers
 */
export function getSecurityHeaders(
  contentType: string = 'application/json',
  additionalHeaders: Record<string, string> = {},
): SecurityHeaders {
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
 * @returns Object containing security headers for JSON responses
 */
export function getJsonHeaders(additionalHeaders: Record<string, string> = {}): SecurityHeaders {
  return getSecurityHeaders('application/json', additionalHeaders);
}

/**
 * Get headers for problem+json error responses (RFC 7807)
 *
 * @param additionalHeaders - Additional headers to merge
 * @returns Object containing security headers for problem+json responses
 */
export function getProblemJsonHeaders(
  additionalHeaders: Record<string, string> = {},
): SecurityHeaders {
  return getSecurityHeaders('application/problem+json', additionalHeaders);
}

/**
 * Get headers for responses that should not be cached
 *
 * @param contentType - Content type for the response
 * @param additionalHeaders - Additional headers to merge
 * @returns Object containing security headers with no-cache directives
 */
export function getNoCacheHeaders(
  contentType: string = 'application/json',
  additionalHeaders: Record<string, string> = {},
): SecurityHeaders {
  return getSecurityHeaders(contentType, {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    ...additionalHeaders,
  });
}
