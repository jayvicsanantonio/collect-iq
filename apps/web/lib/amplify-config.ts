import { Amplify } from 'aws-amplify';
import { env } from './env';

/**
 * Configure AWS Amplify with Cognito User Pool and OAuth settings.
 * This should be called once at application startup.
 */
export function configureAmplify() {
  const redirectSignInValues = buildRedirectVariants(env.NEXT_PUBLIC_OAUTH_REDIRECT_URI);
  const redirectSignOutValues = buildRedirectVariants(env.NEXT_PUBLIC_OAUTH_LOGOUT_URI);

  Amplify.configure({
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
            responseType: 'code',
          },
        },
      },
    },
    aws_project_region: env.NEXT_PUBLIC_AWS_REGION,
  });
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
