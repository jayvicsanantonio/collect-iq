output "policy_arn" {
  description = "ARN of the Rekognition access IAM policy"
  value       = aws_iam_policy.rekognition_access.arn
}

output "policy_id" {
  description = "ID of the Rekognition access IAM policy"
  value       = aws_iam_policy.rekognition_access.id
}

output "policy_name" {
  description = "Name of the Rekognition access IAM policy"
  value       = aws_iam_policy.rekognition_access.name
}
