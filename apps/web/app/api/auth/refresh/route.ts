import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { parseJWT } from '@/lib/auth';
import { getCacheHeaders, CACHE_PRESETS } from '@/lib/cache-headers';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/refresh
 * Refreshes the access token using the refresh token
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token' },
        {
          status: 401,
          headers: getCacheHeaders(CACHE_PRESETS.NO_CACHE),
        }
      );
    }

    // Exchange refresh token for new access token
    const tokenEndpoint = `https://${env.NEXT_PUBLIC_COGNITO_DOMAIN}/oauth2/token`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
      refresh_token: refreshToken,
    });

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Token refresh failed:', error);
      return NextResponse.json(
        { error: 'Token refresh failed' },
        {
          status: 401,
          headers: getCacheHeaders(CACHE_PRESETS.NO_CACHE),
        }
      );
    }

    const tokens = await response.json();

    // Set new tokens in HTTP-only cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    cookieStore.set('access_token', tokens.access_token, {
      ...cookieOptions,
      maxAge: tokens.expires_in || 3600, // 1 hour default
    });

    cookieStore.set('id_token', tokens.id_token, {
      ...cookieOptions,
      maxAge: tokens.expires_in || 3600,
    });

    // Parse tokens for session response
    const idPayload = parseJWT(tokens.id_token);
    const accessPayload = parseJWT(tokens.access_token);

    const session = {
      sub: idPayload.sub as string,
      email: idPayload.email as string,
      emailVerified: idPayload.email_verified as boolean,
      accessToken: tokens.access_token,
      refreshToken,
      idToken: tokens.id_token,
      expiresAt: (accessPayload.exp as number) * 1000,
    };

    // Token refresh should not be cached (security-sensitive)
    return NextResponse.json(session, {
      headers: getCacheHeaders(CACHE_PRESETS.NO_CACHE),
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh token' },
      {
        status: 500,
        headers: getCacheHeaders(CACHE_PRESETS.NO_CACHE),
      }
    );
  }
}
