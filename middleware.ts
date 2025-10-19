import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Lightweight middleware for protected routes
 *
 * Note: This middleware provides basic route protection for better UX.
 * Since Amplify stores tokens in browser storage (not cookies), the middleware
 * cannot access them directly. The actual authentication check happens client-side
 * in the AuthGuard component, which uses Amplify's fetchAuthSession.
 *
 * This middleware simply ensures protected routes are wrapped with proper layouts
 * that include AuthGuard. The AuthGuard component will handle:
 * - Checking authentication status via Amplify
 * - Redirecting to sign-in if unauthenticated
 * - Periodic session checks
 * - Token refresh
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route is protected
  const isProtectedRoute =
    pathname.startsWith('/upload') ||
    pathname.startsWith('/vault') ||
    pathname.startsWith('/cards');

  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Allow request to proceed - AuthGuard in the layout will handle authentication
  // This provides better UX than redirecting here, as AuthGuard can:
  // 1. Show loading states while checking auth
  // 2. Access Amplify tokens from browser storage
  // 3. Handle sign-in redirects with proper state management
  return NextResponse.next();
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
