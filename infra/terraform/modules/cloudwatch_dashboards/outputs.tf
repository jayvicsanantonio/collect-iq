output "api_performance_dashboard_arn" {
  description = "ARN of the API performance dashboard"
  value       = aws_cloudwatch_dashboard.api_performance.dashboard_arn
}

output "lambda_performance_dashboard_arn" {
  description = "ARN of the Lambda performance dashboard"
  value       = aws_cloudwatch_dashboard.lambda_performance.dashboard_arn
}

output "step_functions_dashboard_arn" {
  description = "ARN of the Step Functions dashboard"
  value       = var.step_functions_state_machine_name != "" ? aws_cloudwatch_dashboard.step_functions[0].dashboard_arn : ""
}

output "data_layer_dashboard_arn" {
  description = "ARN of the data layer dashboard"
  value       = aws_cloudwatch_dashboard.data_layer.dashboard_arn
}

output "ai_services_dashboard_arn" {
  description = "ARN of the AI services dashboard"
  value       = aws_cloudwatch_dashboard.ai_services.dashboard_arn
}

output "dashboard_names" {
  description = "List of all dashboard names"
  value = concat(
    [aws_cloudwatch_dashboard.api_performance.dashboard_name],
    [aws_cloudwatch_dashboard.lambda_performance.dashboard_name],
    var.step_functions_state_machine_name != "" ? [aws_cloudwatch_dashboard.step_functions[0].dashboard_name] : [],
    [aws_cloudwatch_dashboard.data_layer.dashboard_name],
    [aws_cloudwatch_dashboard.ai_services.dashboard_name]
  )
}
