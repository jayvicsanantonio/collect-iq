# Main Terraform configuration for hackathon environment
# This file will import and configure all infrastructure modules

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}

# Local variables for resource naming and configuration
locals {
  account_id  = data.aws_caller_identity.current.account_id
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Common tags for all resources
  common_tags = {
    Project     = "CollectIQ"
    Environment = var.environment
    Owner       = "DevOps"
    ManagedBy   = "Terraform"
    CostCenter  = "Engineering"
  }
}

# ============================================================================
# VPC
# ============================================================================
module "vpc" {
  source = "../../modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  vpc_cidr             = "172.28.0.0/21"
  public_subnet_count  = 2
  private_subnet_count = 2
}

# Security group for Lambda functions
resource "aws_security_group" "lambda" {
  name_prefix = "${local.name_prefix}-lambda-"
  description = "Security group for Lambda functions"
  vpc_id      = module.vpc.vpc_id

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-lambda-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

# ============================================================================
# S3 Uploads Bucket
# ============================================================================
module "s3_uploads" {
  source = "../../modules/s3_uploads"

  bucket_name = "${local.name_prefix}-uploads-${local.account_id}"

  enable_versioning = true

  cors_allowed_origins = ["*"] # Will be restricted to Amplify domain after deployment
  cors_allowed_methods = ["PUT", "POST", "GET"]
  cors_allowed_headers = ["*"]
  cors_expose_headers  = ["ETag"]
  cors_max_age_seconds = 3000

  #glacier_transition_days = 90
  #expiration_days         = 365

  tags = local.common_tags
}

# ============================================================================
# DynamoDB Table
# ============================================================================
module "dynamodb_collectiq" {
  source = "../../modules/dynamodb_collectiq"

  table_name   = "${local.name_prefix}-cards"
  billing_mode = "PAY_PER_REQUEST"

  gsi1_name = "GSI1"
  gsi2_name = "GSI2"

  enable_point_in_time_recovery = true
  enable_ttl                     = true
  ttl_attribute                  = "ttl"

  tags = local.common_tags
}

## ============================================================================
## Cognito User Pool
## ============================================================================
module "cognito_user_pool" {
  source = "../../modules/cognito_user_pool"

  user_pool_name = "${local.name_prefix}-users"

  auto_verified_attributes = ["email"]
  mfa_configuration        = "OFF"

  password_policy = {
    minimum_length    = 8
    require_uppercase = true
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
  }

  app_client_name = "${local.name_prefix}-web-client"

  # Callback URLs will be updated after Amplify deployment
  callback_urls = [
    "http://localhost:3000/auth/callback",
    "https://localhost:3000/auth/callback"
  ]

  logout_urls = [
    "http://localhost:3000",
    "https://localhost:3000"
  ]

  allowed_oauth_flows  = ["code"]
  allowed_oauth_scopes = ["openid", "email", "profile"]

  hosted_ui_domain_prefix = "${var.project_name}-${var.environment}"

  tags = local.common_tags
}

## ============================================================================
## Secrets Manager
## ============================================================================
module "ssm_secrets" {
  source = "../../modules/ssm_secrets"

  secrets = {
    ebay = {
      name          = "${local.name_prefix}/ebay-api-key"
      description   = "eBay API key for pricing data"
    }
    tcgplayer = {
      name          = "${local.name_prefix}/tcgplayer-api-keys"
      description   = "TCGPlayer public and private API keys"
    }
    pricecharting = {
      name          = "${local.name_prefix}/pricecharting-api-key"
      description   = "PriceCharting API key for pricing data"
    }
  }

  policy_name        = "${local.name_prefix}-secrets-read"
  policy_description = "IAM policy for reading CollectIQ secrets"

  tags = local.common_tags
}

## ============================================================================
## IAM Policies for AI Services
## ============================================================================
module "rekognition_access" {
  source = "../../modules/rekognition_access"

  policy_name        = "${local.name_prefix}-rekognition-access"
  policy_description = "IAM policy for Rekognition and S3 access"

  uploads_bucket_arn = module.s3_uploads.bucket_arn
  samples_bucket_arn = "" # Optional authentic samples bucket

  tags = local.common_tags
}

module "bedrock_access" {
  source = "../../modules/bedrock_access"

  policy_name        = "${local.name_prefix}-bedrock-access"
  policy_description = "IAM policy for Bedrock model invocation"

  model_ids = [
    "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0"
  ]

  tags = local.common_tags
}

## ============================================================================
## EventBridge Event Bus
## ============================================================================
module "eventbridge_bus" {
  source = "../../modules/eventbridge_bus"

  bus_name = "${local.name_prefix}-events"

  # Event rules will be added when Lambda targets are deployed
  event_rules = {}

  dlq_message_retention_seconds = 1209600 # 14 days
  retry_maximum_event_age       = 86400   # 24 hours
  retry_maximum_retry_attempts  = 3

  tags = local.common_tags
}

## ============================================================================
## Amplify Hosting (Frontend)
## ============================================================================
module "amplify_hosting" {
  source = "../../modules/amplify_hosting"

  app_name   = "${local.name_prefix}-web"
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
    applications:
      - appRoot: apps/web
        frontend:
          phases:
            preBuild:
              commands:
                - npm install -g pnpm@9
                - pnpm install --frozen-lockfile
            build:
              commands:
                - pnpm build
          artifacts:
            baseDirectory: .next
            files:
              - '**/*'
          cache:
            paths:
              - node_modules/**/*
              - .next/cache/**/*
  EOT

  tags = local.common_tags
}

## Note: Lambda functions, Step Functions, and CloudWatch dashboards
## will be added in subsequent tasks when function code is ready for deployment
