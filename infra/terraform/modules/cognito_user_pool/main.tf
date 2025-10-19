resource "aws_cognito_user_pool" "pool" {
  name = var.user_pool_name

  # Email-based sign-up
  username_attributes      = ["email"]
  auto_verified_attributes = var.auto_verified_attributes

  # Password policy
  password_policy {
    minimum_length                   = var.password_policy.minimum_length
    require_uppercase                = var.password_policy.require_uppercase
    require_lowercase                = var.password_policy.require_lowercase
    require_numbers                  = var.password_policy.require_numbers
    require_symbols                  = var.password_policy.require_symbols
    temporary_password_validity_days = 7
  }

  # MFA configuration
  mfa_configuration = var.mfa_configuration

  # Software token MFA (TOTP) configuration
  dynamic "software_token_mfa_configuration" {
    for_each = var.mfa_configuration != "OFF" ? [1] : []
    content {
      enabled = true
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # User attribute schema
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  tags = var.tags
}

resource "aws_cognito_user_pool_client" "client" {
  name         = var.app_client_name
  user_pool_id = aws_cognito_user_pool.pool.id

  # OAuth settings
  allowed_oauth_flows                  = var.allowed_oauth_flows
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = var.allowed_oauth_scopes
  callback_urls                        = var.callback_urls
  logout_urls                          = var.logout_urls
  supported_identity_providers         = ["COGNITO"]

  # Token validity
  id_token_validity      = 60
  access_token_validity  = 60
  refresh_token_validity = 30

  token_validity_units {
    id_token      = "minutes"
    access_token  = "minutes"
    refresh_token = "days"
  }

  # Security settings
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true

  # PKCE for enhanced security
  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

resource "aws_cognito_user_pool_domain" "domain" {
  domain       = var.hosted_ui_domain_prefix
  user_pool_id = aws_cognito_user_pool.pool.id
}
