output "api_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.api.id
}

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "api_arn" {
  description = "API Gateway ARN"
  value       = aws_apigatewayv2_api.api.arn
}

output "api_execution_arn" {
  description = "API Gateway execution ARN"
  value       = aws_apigatewayv2_api.api.execution_arn
}

output "authorizer_id" {
  description = "JWT authorizer ID"
  value       = var.cognito_user_pool_arn != "" ? aws_apigatewayv2_authorizer.jwt[0].id : ""
}

output "stage_id" {
  description = "API Gateway stage ID"
  value       = aws_apigatewayv2_stage.default.id
}

output "stage_invoke_url" {
  description = "API Gateway stage invoke URL"
  value       = aws_apigatewayv2_stage.default.invoke_url
}
