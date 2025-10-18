# Step Functions Outputs

output "step_functions_state_machine_arn" {
  description = "ARN of the Step Functions state machine"
  value       = module.step_functions.state_machine_arn
}

output "step_functions_state_machine_name" {
  description = "Name of the Step Functions state machine"
  value       = module.step_functions.state_machine_name
}

output "step_functions_role_arn" {
  description = "ARN of the Step Functions execution role"
  value       = module.step_functions.role_arn
}

output "step_functions_log_group_name" {
  description = "CloudWatch log group name for Step Functions"
  value       = module.step_functions.log_group_name
}
