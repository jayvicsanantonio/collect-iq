resource "aws_amplify_app" "app" {
  name       = var.app_name
  repository = var.repository

  # GitHub access token (required for private repos)
  access_token = var.access_token != "" ? var.access_token : null

  # Build settings for Next.js SSR/ISR
  build_spec = var.build_spec

  # Environment variables for Next.js
  environment_variables = var.environment_variables

  # Enable auto branch creation for PR previews
  enable_auto_branch_creation = var.enable_auto_branch_creation
  auto_branch_creation_patterns = var.auto_branch_creation_patterns

  # Platform for Next.js SSR
  platform = "WEB_COMPUTE"

  tags = var.tags
}

resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.app.id
  branch_name = var.main_branch_name

  enable_auto_build = true
  stage             = "PRODUCTION"

  tags = var.tags
}

# Webhook to trigger builds
resource "aws_amplify_webhook" "main" {
  app_id      = aws_amplify_app.app.id
  branch_name = aws_amplify_branch.main.branch_name
  description = "Webhook for ${var.main_branch_name} branch"
}

resource "aws_amplify_branch" "develop" {
  count = var.enable_develop_branch ? 1 : 0

  app_id      = aws_amplify_app.app.id
  branch_name = var.develop_branch_name

  enable_auto_build = true
  stage             = "DEVELOPMENT"

  tags = var.tags
}

resource "aws_amplify_domain_association" "custom" {
  count = var.custom_domain != "" ? 1 : 0

  app_id      = aws_amplify_app.app.id
  domain_name = var.custom_domain

  # Main branch subdomain
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = var.custom_domain_prefix
  }

  # Develop branch subdomain (if enabled)
  dynamic "sub_domain" {
    for_each = var.enable_develop_branch ? [1] : []
    content {
      branch_name = aws_amplify_branch.develop[0].branch_name
      prefix      = "dev"
    }
  }
}
