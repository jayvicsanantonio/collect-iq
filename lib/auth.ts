import {
  signInWithRedirect,
  signOut as amplifySignOut,
  fetchAuthSession,
} from 'aws-amplify/auth';

/**
 * User session interface representing authenticated user data
 */
export interface UserSession {
  sub: string; // Cognito user ID
  email: string;
  emailVerified: boolean;
  accessToken: string;
  expiresAt: number; // Unix timestamp
}

/**
 * User info interface for current user details
 */
export interface UserInfo {
  sub: string;
  email?: string;
  emailVerified?: boolean;
}

/**
 * Initiate sign in flow by redirecting to Cognito Hosted UI
 * Amplify handles PKCE, state management, and callback automatically
 */
export async function signIn(): Promise<void> {
  await signInWithRedirect();
}

/**
 * Sign out the user and redirect to Cognito logout
 * Amplify handles session cleanup and logout redirect automatically
 */
export async function signOut(): Promise<void> {
  await amplifySignOut();
}

/**
 * Get the current access token from Amplify session
 * Amplify automatically refreshes tokens when needed
 * @returns Access token string or null if not authenticated
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    const accessToken = session.tokens?.accessToken?.toString();
    return accessToken || null;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

/**
 * Check if user is currently authenticated
 * @returns True if user has valid session
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await fetchAuthSession();
    return !!session.tokens?.accessToken;
  } catch (error) {
    console.error('Failed to check authentication:', error);
    return false;
  }
}

/**
 * Get current user information
 * @returns User info or null if not authenticated
 */
export async function getCurrentUserInfo(): Promise<UserInfo | null> {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;
    if (!idToken) return null;

    // Get user info from ID token payload instead of fetchUserAttributes
    // This avoids the "Access Token does not have required scopes" error
    const payload = idToken.payload;

    return {
      sub: (payload.sub as string) || '',
      email: payload.email as string | undefined,
      emailVerified: payload.email_verified === true,
    };
  } catch (error) {
    console.error('Failed to get user info:', error);
    return null;
  }
}

/**
 * Get current user session with token details
 * @returns User session or null if not authenticated
 */
export async function getSession(): Promise<UserSession | null> {
  try {
    const session = await fetchAuthSession();

    const accessToken = session.tokens?.accessToken;
    const idToken = session.tokens?.idToken;
    if (!accessToken || !idToken) return null;

    // Get user info from ID token payload instead of fetchUserAttributes
    // This avoids the "Access Token does not have required scopes" error
    const payload = idToken.payload;

    return {
      sub: (payload.sub as string) || '',
      email: (payload.email as string) || '',
      emailVerified: payload.email_verified === true,
      accessToken: accessToken.toString(),
      expiresAt: (accessToken.payload.exp as number) * 1000,
    };
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}
