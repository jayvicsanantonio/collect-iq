# Outputs for hackathon environment
# These outputs will be used by frontend and backend applications

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "name_prefix" {
  description = "Resource name prefix"
  value       = local.name_prefix
}

## ============================================================================
## Backend Outputs
## ============================================================================
output "dynamodb_table_name" {
  description = "DynamoDB table name"
  value       = module.dynamodb_collectiq.table_name
}

output "dynamodb_table_arn" {
  description = "DynamoDB table ARN"
  value       = module.dynamodb_collectiq.table_arn
}

output "s3_uploads_bucket" {
  description = "S3 uploads bucket name"
  value       = module.s3_uploads.bucket_name
}

output "s3_uploads_bucket_arn" {
  description = "S3 uploads bucket ARN"
  value       = module.s3_uploads.bucket_arn
}

output "eventbridge_bus_name" {
  description = "EventBridge bus name"
  value       = module.eventbridge_bus.bus_name
}

output "eventbridge_bus_arn" {
  description = "EventBridge bus ARN"
  value       = module.eventbridge_bus.bus_arn
}

## ============================================================================
## Frontend Outputs
## ============================================================================
#
#output "amplify_app_id" {
#  description = "Amplify app ID"
#  value       = module.amplify_hosting.app_id
#}
#
#output "amplify_default_domain" {
#  description = "Amplify default domain"
#  value       = module.amplify_hosting.default_domain
#}
#
#output "amplify_main_branch_url" {
#  description = "Amplify main branch URL"
#  value       = module.amplify_hosting.main_branch_url
#}
#
## ============================================================================
## Authentication Outputs
## ============================================================================

output "cognito_user_pool_id" {
  description = "Cognito user pool ID"
  value       = module.cognito_user_pool.user_pool_id
}

output "cognito_user_pool_arn" {
  description = "Cognito user pool ARN"
  value       = module.cognito_user_pool.user_pool_arn
}

output "cognito_client_id" {
  description = "Cognito app client ID"
  value       = module.cognito_user_pool.client_id
}

output "cognito_hosted_ui_domain" {
  description = "Cognito Hosted UI domain"
  value       = module.cognito_user_pool.hosted_ui_domain
}

output "cognito_jwks_url" {
  description = "Cognito JWKS URL for JWT validation"
  value       = module.cognito_user_pool.jwks_url
}

## ============================================================================
## IAM Policy Outputs
## ============================================================================

output "rekognition_policy_arn" {
  description = "Rekognition access policy ARN"
  value       = module.rekognition_access.policy_arn
}

output "bedrock_policy_arn" {
  description = "Bedrock access policy ARN"
  value       = module.bedrock_access.policy_arn
}

output "secrets_policy_arn" {
  description = "Secrets Manager read policy ARN"
  value       = module.ssm_secrets.policy_arn
}

## ============================================================================
## Secrets Manager Outputs
## ============================================================================

output "secret_arns" {
  description = "Map of secret names to ARNs"
  value       = module.ssm_secrets.secret_arns
  sensitive   = true
}

## ============================================================================
## Monitoring Outputs
## ============================================================================

output "cloudwatch_dashboard_names" {
  description = "List of CloudWatch dashboard names"
  value       = module.cloudwatch_dashboards.dashboard_names
}

output "cloudwatch_alarms_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  value       = aws_sns_topic.cloudwatch_alarms.arn
}
