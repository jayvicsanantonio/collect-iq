# Environment Configuration Guide

This guide explains how to configure environment variables for the CollectIQ web application with AWS Cognito Hosted UI authentication.

## Quick Start

1. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Update the values in `.env.local` with your AWS Cognito configuration

3. Verify your configuration by running the dev server:
   ```bash
   pnpm dev
   ```

## Required Environment Variables

### AWS Configuration

#### `NEXT_PUBLIC_AWS_REGION`

- **Required**: Yes
- **Format**: `us-east-1`, `eu-west-1`, etc.
- **Description**: AWS region where your Cognito User Pool is located
- **Example**: `us-east-1`

### Cognito Configuration

#### `NEXT_PUBLIC_COGNITO_USER_POOL_ID`

- **Required**: Yes
- **Format**: `<region>_<alphanumeric>` (e.g., `us-east-1_abc123XYZ`)
- **Description**: Your Cognito User Pool ID
- **Where to find**: AWS Console > Cognito > User Pools > Select your pool > General settings
- **Example**: `us-east-1_abc123XYZ`

#### `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`

- **Required**: Yes
- **Format**: 26-character alphanumeric string
- **Description**: Your Cognito App Client ID
- **Where to find**: AWS Console > Cognito > User Pools > Your pool > App Integration > App clients
- **Example**: `1a2b3c4d5e6f7g8h9i0j1k2l3m`

#### `NEXT_PUBLIC_COGNITO_DOMAIN`

- **Required**: Yes
- **Format**: `<domain-prefix>.auth.<region>.amazoncognito.com`
- **Description**: Your Cognito Hosted UI domain
- **Where to find**: AWS Console > Cognito > User Pools > Your pool > App Integration > Domain
- **Example**: `collectiq-dev.auth.us-east-1.amazoncognito.com`

### OAuth Configuration

#### `NEXT_PUBLIC_OAUTH_REDIRECT_URI`

- **Required**: Yes
- **Format**: Valid URL ending with `/`
- **Description**: Where Cognito redirects after successful authentication
- **Important**: Must point to root (`/`) for AWS Amplify to handle callback automatically
- **Cognito Setup**: Add this URL to "Allowed callback URLs" in your App Client settings
- **Development**: `http://localhost:3000/`
- **Production**: `https://app.collectiq.com/`

#### `NEXT_PUBLIC_OAUTH_LOGOUT_URI`

- **Required**: Yes
- **Format**: Valid URL
- **Description**: Where Cognito redirects after sign out
- **Cognito Setup**: Add this URL to "Allowed sign-out URLs" in your App Client settings
- **Development**: `http://localhost:3000`
- **Production**: `https://app.collectiq.com`

### API Configuration

#### `NEXT_PUBLIC_API_BASE`

- **Required**: Yes
- **Format**: Valid URL (http:// or https://)
- **Description**: Backend API base URL (API Gateway endpoint)
- **Development**: Your API Gateway URL (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com`)
- **Production**: `https://api.collectiq.com`

## Optional Environment Variables

### `FEATURE_FLAGS`

- **Required**: No
- **Format**: Comma-separated string
- **Description**: Enable/disable features
- **Example**: `feature1,feature2,feature3`

### `NEXT_PUBLIC_ANALYTICS_ID`

- **Required**: No
- **Format**: String
- **Description**: Analytics tracking ID

### `SENTRY_DSN`

- **Required**: No
- **Format**: Valid Sentry DSN URL
- **Description**: Sentry error tracking configuration

## Cognito App Client Configuration

To use the Hosted UI with these environment variables, ensure your Cognito App Client is configured with:

### OAuth 2.0 Settings

1. **Allowed callback URLs**: Add your `NEXT_PUBLIC_OAUTH_REDIRECT_URI`
   - Development: `http://localhost:3000/`
   - Production: `https://app.collectiq.com/`

2. **Allowed sign-out URLs**: Add your `NEXT_PUBLIC_OAUTH_LOGOUT_URI`
   - Development: `http://localhost:3000`
   - Production: `https://app.collectiq.com`

3. **OAuth 2.0 grant types**:
   - ✅ Authorization code grant
   - ❌ Implicit grant (not needed with Amplify)

4. **OAuth scopes**:
   - ✅ openid (required)
   - ✅ email
   - ✅ profile

### App Client Settings

1. **Authentication flows**:
   - ✅ ALLOW_USER_SRP_AUTH
   - ✅ ALLOW_REFRESH_TOKEN_AUTH

2. **Prevent user existence errors**: Enabled (recommended)

3. **Token expiration**:
   - Access token: 60 minutes (default)
   - ID token: 60 minutes (default)
   - Refresh token: 30 days (default)

## Validation

The application validates all environment variables at build time using Zod schemas. If any required variable is missing or invalid, you'll see a clear error message indicating which variable needs to be fixed.

### Common Validation Errors

1. **"AWS region must be in format: us-east-1, eu-west-1, etc."**
   - Fix: Use a valid AWS region format (e.g., `us-east-1`)

2. **"Cognito User Pool ID must be in format: us-east-1_abc123XYZ"**
   - Fix: Ensure your User Pool ID matches the format `<region>_<alphanumeric>`

3. **"Cognito Domain must be in format: domain.auth.region.amazoncognito.com"**
   - Fix: Use the full Cognito domain including `.auth.<region>.amazoncognito.com`

4. **"OAuth Redirect URI must be a valid URL"**
   - Fix: Ensure the redirect URI is a fully qualified URL that exactly matches the value configured in Cognito (including path and optional trailing slash)

## Troubleshooting

### "Invalid environment variables" error on startup

1. Check that all required variables are set in `.env.local`
2. Verify the format of each variable matches the requirements above
3. Check the console output for specific validation errors

### Authentication redirects to wrong URL

1. Verify `NEXT_PUBLIC_OAUTH_REDIRECT_URI` matches your Cognito App Client's allowed callback URLs
2. Ensure the redirect URI matches exactly (including trailing slash if you added one in Cognito)
3. Check that the domain matches (localhost vs production domain)

### "Not authenticated" errors when making API calls

1. Verify `NEXT_PUBLIC_API_BASE` points to your API Gateway endpoint
2. Ensure your API Gateway has a JWT authorizer configured for your Cognito User Pool
3. Check that the Cognito User Pool ID in the JWT authorizer matches your `NEXT_PUBLIC_COGNITO_USER_POOL_ID`

## Environment-Specific Configurations

### Development

```bash
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_devPoolId
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=devClientId123456789012345
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq-dev.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000
NEXT_PUBLIC_API_BASE=https://dev-api.execute-api.us-east-1.amazonaws.com
```

### Production

```bash
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_prodPoolId
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=prodClientId123456789012345
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://app.collectiq.com/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=https://app.collectiq.com
NEXT_PUBLIC_API_BASE=https://api.collectiq.com
```

## Security Notes

1. **Never commit `.env.local`** to version control - it contains sensitive configuration
2. **Use different Cognito User Pools** for development and production
3. **Rotate App Client secrets** regularly (if using client secrets)
4. **Limit OAuth scopes** to only what your application needs
5. **Use HTTPS** in production for all URLs
6. **Enable MFA** in Cognito for production user pools

## Additional Resources

- [AWS Amplify Authentication Documentation](https://docs.amplify.aws/lib/auth/getting-started/q/platform/js/)
- [Amazon Cognito User Pools Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)
- [PKCE (Proof Key for Code Exchange)](https://oauth.net/2/pkce/)
