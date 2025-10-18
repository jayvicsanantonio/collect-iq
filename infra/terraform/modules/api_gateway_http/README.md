# API Gateway HTTP Module

This module provisions AWS API Gateway HTTP API with Cognito JWT authorizer and Lambda integrations.

## Features

- HTTP API (cost-efficient alternative to REST API)
- Cognito JWT authorizer for protected routes
- CORS configuration
- Throttling settings for cost control
- CloudWatch access logging
- Lambda proxy integrations
- Automatic Lambda permissions

## Usage

```hcl
module "api_gateway" {
  source = "../../modules/api_gateway_http"

  api_name        = "collectiq-hackathon-api"
  api_description = "CollectIQ API Gateway"

  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_user_pool_arn = module.cognito.user_pool_arn
  cognito_client_id     = module.cognito.client_id

  cors_allow_origins = ["https://app.example.com"]

  throttling_burst_limit = 100
  throttling_rate_limit  = 100

  lambda_integrations = {
    healthz = {
      lambda_function_name = module.healthz_lambda.function_name
      lambda_invoke_arn    = module.healthz_lambda.invoke_arn
      route_key            = "GET /healthz"
      require_auth         = false
    }
    upload_presign = {
      lambda_function_name = module.presign_lambda.function_name
      lambda_invoke_arn    = module.presign_lambda.invoke_arn
      route_key            = "POST /upload/presign"
      require_auth         = true
    }
  }

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}
```

## Inputs

| Name                  | Description                | Type        | Default | Required |
| --------------------- | -------------------------- | ----------- | ------- | -------- |
| api_name              | Name of the API Gateway    | string      | -       | yes      |
| cognito_user_pool_id  | Cognito user pool ID       | string      | ""      | no       |
| lambda_integrations   | Map of Lambda integrations | map(object) | {}      | yes      |
| throttling_rate_limit | Rate limit (req/s)         | number      | 100     | no       |

## Outputs

| Name             | Description              |
| ---------------- | ------------------------ |
| api_endpoint     | API Gateway endpoint URL |
| api_id           | API Gateway ID           |
| authorizer_id    | JWT authorizer ID        |
| stage_invoke_url | Stage invoke URL         |
