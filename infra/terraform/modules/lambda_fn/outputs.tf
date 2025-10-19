output "function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.function.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.function.arn
}

output "invoke_arn" {
  description = "Lambda function invoke ARN"
  value       = aws_lambda_function.function.invoke_arn
}

output "qualified_arn" {
  description = "Lambda function qualified ARN"
  value       = aws_lambda_function.function.qualified_arn
}

output "version" {
  description = "Lambda function version"
  value       = aws_lambda_function.function.version
}

output "role_arn" {
  description = "Lambda execution role ARN"
  value       = aws_iam_role.lambda_role.arn
}

output "role_name" {
  description = "Lambda execution role name"
  value       = aws_iam_role.lambda_role.name
}

output "alias_arn" {
  description = "Lambda alias ARN (if created)"
  value       = var.create_alias ? aws_lambda_alias.alias[0].arn : ""
}

output "alias_invoke_arn" {
  description = "Lambda alias invoke ARN (if created)"
  value       = var.create_alias ? aws_lambda_alias.alias[0].invoke_arn : ""
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}
