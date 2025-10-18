import { z } from 'zod';

const envSchema = z.object({
  // AWS Configuration
  NEXT_PUBLIC_AWS_REGION: z
    .string()
    .min(1, 'AWS region is required (e.g., us-east-1)')
    .regex(
      /^[a-z]{2}-[a-z]+-\d{1}$/,
      'AWS region must be in format: us-east-1, eu-west-1, etc.'
    ),

  // Cognito Configuration
  NEXT_PUBLIC_COGNITO_USER_POOL_ID: z
    .string()
    .min(1, 'Cognito User Pool ID is required')
    .regex(
      /^[a-z]{2}-[a-z]+-\d{1}_[a-zA-Z0-9]+$/,
      'Cognito User Pool ID must be in format: us-east-1_abc123XYZ'
    ),
  NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID: z
    .string()
    .min(1, 'Cognito Client ID is required')
    .min(26, 'Cognito Client ID should be 26 characters'),
  NEXT_PUBLIC_COGNITO_DOMAIN: z
    .string()
    .min(1, 'Cognito Domain is required')
    .regex(
      /^[a-z0-9-]+\.auth\.[a-z]{2}-[a-z]+-\d{1}\.amazoncognito\.com$/,
      'Cognito Domain must be in format: domain.auth.region.amazoncognito.com'
    ),

  // OAuth Configuration
  NEXT_PUBLIC_OAUTH_REDIRECT_URI: z
    .string()
    .url('OAuth Redirect URI must be a valid URL')
    .refine(
      (url) => url.endsWith('/'),
      'OAuth Redirect URI should end with / for Amplify to handle callback'
    ),
  NEXT_PUBLIC_OAUTH_LOGOUT_URI: z
    .string()
    .url('OAuth Logout URI must be a valid URL'),

  // API Configuration
  NEXT_PUBLIC_API_BASE: z
    .string()
    .url('API Base URL must be a valid URL')
    .refine(
      (url) => url.startsWith('http://') || url.startsWith('https://'),
      'API Base URL must start with http:// or https://'
    ),

  // Optional Configuration
  FEATURE_FLAGS: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const env = {
    NEXT_PUBLIC_AWS_REGION: process.env.NEXT_PUBLIC_AWS_REGION,
    NEXT_PUBLIC_COGNITO_USER_POOL_ID:
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID:
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID,
    NEXT_PUBLIC_COGNITO_DOMAIN: process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
    NEXT_PUBLIC_OAUTH_REDIRECT_URI: process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI,
    NEXT_PUBLIC_OAUTH_LOGOUT_URI: process.env.NEXT_PUBLIC_OAUTH_LOGOUT_URI,
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE,
    FEATURE_FLAGS: process.env.FEATURE_FLAGS,
    NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID,
    SENTRY_DSN: process.env.SENTRY_DSN,
  };

  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors
    );
    throw new Error('Invalid environment variables');
  }

  return parsed.data;
}

// Validate environment variables at build time
export const env = validateEnv();

// Helper to check if a feature flag is enabled
export function isFeatureEnabled(flag: string): boolean {
  if (!env.FEATURE_FLAGS) return false;
  const flags = env.FEATURE_FLAGS.split(',').map((f) => f.trim());
  return flags.includes(flag);
}
