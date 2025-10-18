# API Gateway HTTP API Configuration for Hackathon Environment
# This file defines the API Gateway with Lambda integrations

# ============================================================================
# API Gateway HTTP API
# ============================================================================
module "api_gateway_http" {
  source = "../../modules/api_gateway_http"

  api_name        = "${local.name_prefix}-api"
  api_description = "CollectIQ API Gateway for hackathon environment"
  stage_name      = "$default"

  # Cognito JWT Authorizer (uncomment when Cognito is deployed)
  cognito_user_pool_id  = module.cognito_user_pool.user_pool_id
  cognito_user_pool_arn = module.cognito_user_pool.user_pool_arn
  cognito_client_id     = module.cognito_user_pool.client_id

  # CORS Configuration
  cors_allow_origins     = ["*"] # Will be restricted to Amplify domain after deployment
  cors_allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  cors_allow_headers     = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Amz-Security-Token"]
  cors_allow_credentials = false #just for testing, set to true once the cors_allow_origins is restricted to a specific domain
  cors_max_age           = 300

  # Throttling
  throttling_burst_limit = 100
  throttling_rate_limit  = 100

  # Logging
  log_retention_days = 30

  # Lambda Integrations
  lambda_integrations = {
    upload_presign = {
      lambda_function_name = module.lambda_upload_presign.function_name
      lambda_invoke_arn    = module.lambda_upload_presign.invoke_arn
      route_key            = "POST /upload/presign"
      require_auth         = true
    }
    cards_create = {
      lambda_function_name = module.lambda_cards_create.function_name
      lambda_invoke_arn    = module.lambda_cards_create.invoke_arn
      route_key            = "POST /cards"
      require_auth         = true
    }
    cards_list = {
      lambda_function_name = module.lambda_cards_list.function_name
      lambda_invoke_arn    = module.lambda_cards_list.invoke_arn
      route_key            = "GET /cards"
      require_auth         = true
    }
    cards_get = {
      lambda_function_name = module.lambda_cards_get.function_name
      lambda_invoke_arn    = module.lambda_cards_get.invoke_arn
      route_key            = "GET /cards/{cardId}"
      require_auth         = true
    }
    cards_delete = {
      lambda_function_name = module.lambda_cards_delete.function_name
      lambda_invoke_arn    = module.lambda_cards_delete.invoke_arn
      route_key            = "DELETE /cards/{cardId}"
      require_auth         = true
    }
    cards_revalue = {
      lambda_function_name = module.lambda_cards_revalue.function_name
      lambda_invoke_arn    = module.lambda_cards_revalue.invoke_arn
      route_key            = "POST /cards/{cardId}/revalue"
      require_auth         = true
    }
  }

  tags = local.common_tags
}

# ============================================================================
# Outputs
# ============================================================================
output "api_gateway_endpoint" {
  description = "API Gateway endpoint URL"
  value       = module.api_gateway_http.api_endpoint
}

output "api_gateway_id" {
  description = "API Gateway ID"
  value       = module.api_gateway_http.api_id
}
