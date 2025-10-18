import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { parseJWT, isTokenExpired } from '@/lib/auth';
import { getCacheHeaders, CACHE_PRESETS } from '@/lib/cache-headers';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/session
 * Returns the current user session from HTTP-only cookies
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    const idToken = cookieStore.get('id_token')?.value;
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (!accessToken || !idToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        {
          status: 401,
          headers: getCacheHeaders(CACHE_PRESETS.NO_CACHE),
        }
      );
    }

    // Check if access token is expired
    if (isTokenExpired(accessToken)) {
      return NextResponse.json(
        { error: 'Token expired' },
        {
          status: 401,
          headers: getCacheHeaders(CACHE_PRESETS.NO_CACHE),
        }
      );
    }

    // Parse ID token for user info
    const idPayload = parseJWT(idToken);
    const accessPayload = parseJWT(accessToken);

    const session = {
      sub: idPayload.sub as string,
      email: idPayload.email as string,
      emailVerified: idPayload.email_verified as boolean,
      accessToken,
      refreshToken: refreshToken || '',
      idToken,
      expiresAt: (accessPayload.exp as number) * 1000,
    };

    // Session data should not be cached (security-sensitive)
    return NextResponse.json(session, {
      headers: getCacheHeaders(CACHE_PRESETS.NO_CACHE),
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      {
        status: 500,
        headers: getCacheHeaders(CACHE_PRESETS.NO_CACHE),
      }
    );
  }
}
