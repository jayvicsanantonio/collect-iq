output "bus_name" {
  description = "EventBridge event bus name"
  value       = aws_cloudwatch_event_bus.bus.name
}

output "bus_arn" {
  description = "EventBridge event bus ARN"
  value       = aws_cloudwatch_event_bus.bus.arn
}

output "dlq_url" {
  description = "Dead letter queue URL"
  value       = aws_sqs_queue.dlq.url
}

output "dlq_arn" {
  description = "Dead letter queue ARN"
  value       = aws_sqs_queue.dlq.arn
}

output "rule_arns" {
  description = "Map of event rule ARNs"
  value       = { for k, v in aws_cloudwatch_event_rule.rules : k => v.arn }
}
