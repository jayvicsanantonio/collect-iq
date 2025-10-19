# OAuth Configuration Guide

## Current Issue Fixed

The `.env.local` file had incorrect OAuth redirect URIs pointing to the Cognito domain instead of the application domain. This has been corrected.

## Local Development Setup

Your `.env.local` is now configured for local development:

```bash
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000/landing
```

These URLs match what's configured in your Terraform:

```hcl
callback_urls = [
  "http://localhost:3000/auth/callback",
  "https://localhost:3000/auth/callback"
]

logout_urls = [
  "http://localhost:3000",
  "https://localhost:3000"
]
```

## Production Deployment Steps

After deploying to AWS Amplify, follow these steps:

### 1. Get Your Amplify URL

```bash
cd infra/terraform/envs/hackathon
terraform output amplify_main_branch_url
```

This will output something like: `https://main.d1234abcd5678.amplifyapp.com`

### 2. Update Cognito Callback URLs

Update `infra/terraform/envs/hackathon/main.tf`:

```hcl
callback_urls = [
  "http://localhost:3000/auth/callback",
  "https://localhost:3000/auth/callback",
  "https://main.d1234abcd5678.amplifyapp.com/auth/callback"  # Add this
]

logout_urls = [
  "http://localhost:3000",
  "https://localhost:3000",
  "https://main.d1234abcd5678.amplifyapp.com/landing"  # Add this
]
```

### 3. Update Terraform Variables

Create or update `infra/terraform/envs/hackathon/terraform.tfvars`:

```hcl
amplify_oauth_redirect_uri = "https://main.d1234abcd5678.amplifyapp.com/auth/callback"
amplify_oauth_logout_uri   = "https://main.d1234abcd5678.amplifyapp.com/landing"
```

### 4. Apply Terraform Changes

```bash
cd infra/terraform/envs/hackathon
terraform apply
```

This will:

- Update Cognito with the new callback URLs
- Update Amplify environment variables with the correct URIs

### 5. Redeploy Amplify

The Amplify app will automatically redeploy with the updated environment variables.

## How OAuth Flow Works

1. **User clicks "Sign In"** → Redirected to Cognito Hosted UI
   - URL: `https://collectiq-hackathon.auth.us-east-1.amazoncognito.com/login`

2. **User authenticates** → Cognito redirects back to your app
   - URL: `http://localhost:3000/auth/callback?code=...&state=...`

3. **Callback handler** (`/auth/callback/page.tsx`) exchanges code for tokens

4. **User is redirected** to the intended destination (stored in state parameter)

## Troubleshooting

### "redirect_uri_mismatch" Error

This means the redirect URI in your request doesn't match what's configured in Cognito.

**Check:**

- `.env.local` has correct `NEXT_PUBLIC_OAUTH_REDIRECT_URI`
- Cognito App Client has the URL in "Allowed callback URLs"
- Ensure trailing slash usage matches between `.env` and Cognito configuration

### "invalid_request" Error

This usually means:

- Missing required OAuth parameters
- Invalid state parameter
- Expired authorization code

**Check:**

- Your auth flow is using PKCE correctly
- State parameter is being preserved
- Code exchange happens within 5 minutes

### Tokens Not Being Stored

**Check:**

- Cookies are being set with correct domain
- `SameSite=Lax` is set (required for OAuth redirects)
- Cookies are `HttpOnly` and `Secure` in production

## Testing Locally

1. Start the dev server:

   ```bash
   pnpm web:dev
   ```

2. Navigate to `http://localhost:3000`

3. Click "Sign In" - you should be redirected to Cognito

4. After signing in, you should be redirected back to `http://localhost:3000/auth/callback`

5. The callback handler should exchange the code for tokens and redirect you to the app

## Security Notes

- **Never** store tokens in localStorage (use HttpOnly cookies)
- **Always** use PKCE for OAuth flows (prevents authorization code interception)
- **Always** validate the state parameter (prevents CSRF attacks)
- **Always** use HTTPS in production (required for Secure cookies)
