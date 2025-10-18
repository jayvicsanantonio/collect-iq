# Cognito User Pool Module

This module provisions Amazon Cognito User Pool with Hosted UI for OAuth 2.0 authentication.

## Features

- Email-based sign-up and authentication
- Configurable password policy
- Optional MFA support
- OAuth 2.0 with authorization code flow and PKCE
- Hosted UI for sign-in/sign-up
- JWT token generation with configurable validity

## Usage

```hcl
module "cognito" {
  source = "../../modules/cognito_user_pool"

  user_pool_name = "collectiq-hackathon"

  password_policy = {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
  }

  auto_verified_attributes = ["email"]
  mfa_configuration        = "OPTIONAL"

  app_client_name = "collectiq-web-hackathon"
  callback_urls   = ["https://app.example.com/auth/callback"]
  logout_urls     = ["https://app.example.com"]

  allowed_oauth_flows  = ["code"]
  allowed_oauth_scopes = ["openid", "email", "profile"]

  hosted_ui_domain_prefix = "collectiq-hackathon"

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}
```

## Inputs

| Name                    | Description                   | Type         | Default    | Required |
| ----------------------- | ----------------------------- | ------------ | ---------- | -------- |
| user_pool_name          | Name of the Cognito user pool | string       | -          | yes      |
| app_client_name         | Name of the app client        | string       | -          | yes      |
| callback_urls           | List of allowed callback URLs | list(string) | -          | yes      |
| logout_urls             | List of allowed logout URLs   | list(string) | -          | yes      |
| hosted_ui_domain_prefix | Domain prefix for Hosted UI   | string       | -          | yes      |
| mfa_configuration       | MFA configuration             | string       | "OPTIONAL" | no       |

## Outputs

| Name             | Description                 |
| ---------------- | --------------------------- |
| user_pool_id     | Cognito user pool ID        |
| client_id        | App client ID               |
| hosted_ui_domain | Hosted UI domain URL        |
| jwks_url         | JWKS URL for JWT validation |
