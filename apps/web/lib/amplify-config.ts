import { Amplify } from 'aws-amplify';
import { env } from './env';

/**
 * Configure AWS Amplify with Cognito User Pool and OAuth settings.
 * This should be called once at application startup.
 */
export function configureAmplify() {
  const redirectSignInValues = buildRedirectVariants(
    env.NEXT_PUBLIC_OAUTH_REDIRECT_URI
  );
  const redirectSignOutValues = buildRedirectVariants(
    env.NEXT_PUBLIC_OAUTH_LOGOUT_URI
  );

  const config = {
    Auth: {
      Cognito: {
        userPoolId: env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
        userPoolClientId: env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: env.NEXT_PUBLIC_COGNITO_DOMAIN,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: redirectSignInValues,
            redirectSignOut: redirectSignOutValues,
            responseType: 'code' as const,
          },
        },
      },
    },
  };

  console.log('🔧 Configuring Amplify with:', {
    userPoolId: config.Auth.Cognito.userPoolId,
    userPoolClientId: config.Auth.Cognito.userPoolClientId,
    domain: config.Auth.Cognito.loginWith?.oauth?.domain,
    redirectSignIn: redirectSignInValues,
    redirectSignOut: redirectSignOutValues,
  });

  Amplify.configure(config, { ssr: true });
  console.log('✅ Amplify configured successfully');
}

function buildRedirectVariants(url: string): string[] {
  const variants = new Set<string>([url]);
  if (url.endsWith('/')) {
    variants.add(url.replace(/\/+$/, ''));
  } else {
    variants.add(`${url}/`);
  }
  return Array.from(variants);
}
