output "state_machine_arn" {
  description = "Step Functions state machine ARN"
  value       = aws_sfn_state_machine.state_machine.arn
}

output "state_machine_id" {
  description = "Step Functions state machine ID"
  value       = aws_sfn_state_machine.state_machine.id
}

output "state_machine_name" {
  description = "Step Functions state machine name"
  value       = aws_sfn_state_machine.state_machine.name
}

output "role_arn" {
  description = "Step Functions execution role ARN"
  value       = aws_iam_role.step_functions_role.arn
}

output "role_name" {
  description = "Step Functions execution role name"
  value       = aws_iam_role.step_functions_role.name
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.step_functions_logs.name
}
