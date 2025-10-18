import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Build Content Security Policy header value
 * Restricts resource loading to trusted domains only
 */
function getCSPHeader(): string {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE || 'https://api.collectiq.com';
  const cognitoDomain =
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN || '*.amazoncognito.com';

  // Extract domain from API base URL
  const apiDomain = new URL(apiBase).hostname;

  const cspDirectives = [
    // Default: only allow resources from same origin
    "default-src 'self'",

    // Scripts: only from same origin (no inline scripts)
    "script-src 'self'",

    // Styles: allow same origin and inline styles (required for Tailwind and styled components)
    "style-src 'self' 'unsafe-inline'",

    // Images: allow same origin, data URIs (for base64 images), and AWS domains
    "img-src 'self' data: https://*.amazonaws.com https://*.cloudfront.net",

    // Fonts: only from same origin
    "font-src 'self'",

    // API connections: allow same origin, API domain, and Cognito
    `connect-src 'self' https://${apiDomain} https://${cognitoDomain} https://*.amazoncognito.com https://*.amazonaws.com`,

    // Media: only from same origin
    "media-src 'self'",

    // Objects/embeds: disallow all
    "object-src 'none'",

    // Frames: disallow embedding this site in iframes
    "frame-ancestors 'none'",

    // Forms: allow same origin and Cognito (for OAuth redirects)
    `form-action 'self' https://${cognitoDomain} https://*.amazoncognito.com`,

    // Base URI: restrict to same origin
    "base-uri 'self'",

    // Upgrade insecure requests in production
    ...(process.env.NODE_ENV === 'production'
      ? ['upgrade-insecure-requests']
      : []),
  ];

  return cspDirectives.join('; ');
}

/**
 * Apply security headers to response
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set('Content-Security-Policy', getCSPHeader());

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (restrict access to browser features)
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), interest-cohort=()'
  );

  return response;
}

/**
 * Middleware for server-side authentication checks and security headers
 * Protects routes that require authentication and applies CSP
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is protected
  const isProtectedRoute =
    pathname.startsWith('/upload') ||
    pathname.startsWith('/vault') ||
    pathname.startsWith('/cards');

  let response: NextResponse;

  if (isProtectedRoute) {
    // Check for access token in cookies
    const accessToken = request.cookies.get('access_token')?.value;

    if (!accessToken) {
      // No token - redirect to home (client-side AuthGuard will handle sign in)
      const url = request.nextUrl.clone();
      url.pathname = '/';
      response = NextResponse.redirect(url);
    } else {
      // Token exists - allow request to proceed
      // Note: Token validation happens in API routes and client-side
      response = NextResponse.next();
    }
  } else {
    response = NextResponse.next();
  }

  // Apply security headers to all responses
  return applySecurityHeaders(response);
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};
