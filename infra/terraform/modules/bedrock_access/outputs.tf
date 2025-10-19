output "policy_arn" {
  description = "ARN of the Bedrock access IAM policy"
  value       = aws_iam_policy.bedrock_access.arn
}

output "policy_id" {
  description = "ID of the Bedrock access IAM policy"
  value       = aws_iam_policy.bedrock_access.id
}

output "policy_name" {
  description = "Name of the Bedrock access IAM policy"
  value       = aws_iam_policy.bedrock_access.name
}

output "model_arns" {
  description = "List of Bedrock model ARNs granted access"
  value       = local.computed_model_arns
}
