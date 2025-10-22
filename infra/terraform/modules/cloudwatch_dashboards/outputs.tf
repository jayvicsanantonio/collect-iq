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

output "ocr_reasoning_alarms_sns_topic_arn" {
  description = "ARN of the SNS topic for OCR reasoning alarms"
  value       = length(aws_sns_topic.ocr_reasoning_alarms) > 0 ? aws_sns_topic.ocr_reasoning_alarms[0].arn : ""
}

output "ocr_high_fallback_rate_alarm_arn" {
  description = "ARN of the high fallback rate alarm"
  value       = length(aws_cloudwatch_metric_alarm.ocr_high_fallback_rate) > 0 ? aws_cloudwatch_metric_alarm.ocr_high_fallback_rate[0].arn : ""
}

output "ocr_high_latency_alarm_arn" {
  description = "ARN of the high latency alarm"
  value       = length(aws_cloudwatch_metric_alarm.ocr_high_latency) > 0 ? aws_cloudwatch_metric_alarm.ocr_high_latency[0].arn : ""
}

output "ocr_low_confidence_alarm_arn" {
  description = "ARN of the low confidence alarm"
  value       = length(aws_cloudwatch_metric_alarm.ocr_low_confidence) > 0 ? aws_cloudwatch_metric_alarm.ocr_low_confidence[0].arn : ""
}

output "ocr_high_token_usage_alarm_arn" {
  description = "ARN of the high token usage alarm"
  value       = length(aws_cloudwatch_metric_alarm.ocr_high_token_usage) > 0 ? aws_cloudwatch_metric_alarm.ocr_high_token_usage[0].arn : ""
}
