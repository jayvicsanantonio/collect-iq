output "secret_arns" {
  description = "Map of secret ARNs"
  value       = { for k, v in aws_secretsmanager_secret.secrets : k => v.arn }
}

output "secret_ids" {
  description = "Map of secret IDs"
  value       = { for k, v in aws_secretsmanager_secret.secrets : k => v.id }
}

output "secret_names" {
  description = "Map of secret names"
  value       = { for k, v in aws_secretsmanager_secret.secrets : k => v.name }
}

output "policy_arn" {
  description = "ARN of the IAM policy for reading secrets"
  value       = aws_iam_policy.secrets_read.arn
}

output "policy_name" {
  description = "Name of the IAM policy for reading secrets"
  value       = aws_iam_policy.secrets_read.name
}
