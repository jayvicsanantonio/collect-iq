output "user_pool_id" {
  description = "Cognito user pool ID"
  value       = aws_cognito_user_pool.pool.id
}

output "user_pool_arn" {
  description = "Cognito user pool ARN"
  value       = aws_cognito_user_pool.pool.arn
}

output "client_id" {
  description = "Cognito user pool client ID"
  value       = aws_cognito_user_pool_client.client.id
}

output "client_secret" {
  description = "Cognito user pool client secret (if applicable)"
  value       = aws_cognito_user_pool_client.client.client_secret
  sensitive   = true
}

output "hosted_ui_domain" {
  description = "Cognito Hosted UI domain (full URL with https://)"
  value       = "https://${aws_cognito_user_pool_domain.domain.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "hosted_ui_domain_name" {
  description = "Cognito Hosted UI domain name (without https://)"
  value       = "${aws_cognito_user_pool_domain.domain.domain}.auth.${data.aws_region.current.name}.amazoncognito.com"
}

output "domain_prefix" {
  description = "Cognito domain prefix only"
  value       = aws_cognito_user_pool_domain.domain.domain
}

output "jwks_url" {
  description = "JWKS URL for JWT validation"
  value       = "https://cognito-idp.${data.aws_region.current.name}.amazonaws.com/${aws_cognito_user_pool.pool.id}/.well-known/jwks.json"
}

data "aws_region" "current" {}
