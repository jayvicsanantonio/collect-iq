import { Amplify } from 'aws-amplify';
import { env } from './env';

/**
 * Configure AWS Amplify with Cognito User Pool and OAuth settings.
 * This should be called once at application startup.
 */
export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
        userPoolClientId: env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: env.NEXT_PUBLIC_COGNITO_DOMAIN,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [env.NEXT_PUBLIC_OAUTH_REDIRECT_URI],
            redirectSignOut: [env.NEXT_PUBLIC_OAUTH_LOGOUT_URI],
            responseType: 'code',
          },
        },
      },
    },
  });
}
