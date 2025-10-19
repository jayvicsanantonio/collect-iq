## ============================================================================
## Amplify Hosting (Frontend)
## ============================================================================
module "amplify_hosting" {
  source = "../../modules/amplify_hosting"

  app_name   = "${local.name_prefix}-ui"
  repository = var.github_repo_url
  access_token = var.github_access_token

  main_branch_name    = "main"
  enable_develop_branch = false

  enable_auto_branch_creation   = true
  auto_branch_creation_patterns = ["pr*"]

  # Use Amplify default domain (no custom domain for hackathon)
  custom_domain        = ""
  custom_domain_prefix = ""

  environment_variables = {
    NEXT_PUBLIC_AWS_REGION                  = var.aws_region
    NEXT_PUBLIC_COGNITO_USER_POOL_ID        = module.cognito_user_pool.user_pool_id
    NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID = module.cognito_user_pool.client_id
    NEXT_PUBLIC_COGNITO_DOMAIN              = module.cognito_user_pool.hosted_ui_domain_name
    # OAuth redirect URIs - will be set after first deployment
    # Use: terraform output amplify_main_branch_url to get the URL
    # Then update these values and run terraform apply again
    NEXT_PUBLIC_OAUTH_REDIRECT_URI          = var.amplify_oauth_redirect_uri
    NEXT_PUBLIC_OAUTH_LOGOUT_URI            = var.amplify_oauth_logout_uri
    NEXT_PUBLIC_API_BASE                    = module.api_gateway_http.api_endpoint
    _LIVE_UPDATES                           = jsonencode([{
      pkg     = "next-version"
      type    = "internal"
      version = "latest"
    }])
  }

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*

  EOT

  tags = local.common_tags
}

## ============================================================================
## Frontend Outputs
## ============================================================================

output "amplify_app_id" {
  description = "Amplify app ID"
  value       = module.amplify_hosting.app_id
}

output "amplify_default_domain" {
  description = "Amplify default domain"
  value       = module.amplify_hosting.default_domain
}

output "amplify_main_branch_url" {
  description = "Amplify main branch URL"
  value       = module.amplify_hosting.main_branch_url
}
