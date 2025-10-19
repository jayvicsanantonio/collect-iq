output "table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.table.name
}

output "table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.table.arn
}

output "table_id" {
  description = "DynamoDB table ID"
  value       = aws_dynamodb_table.table.id
}

output "gsi1_name" {
  description = "GSI1 name"
  value       = var.gsi1_name
}

output "gsi2_name" {
  description = "GSI2 name"
  value       = var.gsi2_name
}

output "stream_arn" {
  description = "DynamoDB stream ARN (if enabled)"
  value       = try(aws_dynamodb_table.table.stream_arn, "")
}
