# Lambda Function Outputs

# ============================================================================
# API Handler Lambda Outputs
# ============================================================================

output "lambda_upload_presign_arn" {
  description = "ARN of the upload_presign Lambda function"
  value       = module.lambda_upload_presign.function_arn
}

output "lambda_upload_presign_invoke_arn" {
  description = "Invoke ARN of the upload_presign Lambda function"
  value       = module.lambda_upload_presign.invoke_arn
}

output "lambda_cards_create_arn" {
  description = "ARN of the cards_create Lambda function"
  value       = module.lambda_cards_create.function_arn
}

output "lambda_cards_create_invoke_arn" {
  description = "Invoke ARN of the cards_create Lambda function"
  value       = module.lambda_cards_create.invoke_arn
}

output "lambda_cards_list_arn" {
  description = "ARN of the cards_list Lambda function"
  value       = module.lambda_cards_list.function_arn
}

output "lambda_cards_list_invoke_arn" {
  description = "Invoke ARN of the cards_list Lambda function"
  value       = module.lambda_cards_list.invoke_arn
}

output "lambda_cards_get_arn" {
  description = "ARN of the cards_get Lambda function"
  value       = module.lambda_cards_get.function_arn
}

output "lambda_cards_get_invoke_arn" {
  description = "Invoke ARN of the cards_get Lambda function"
  value       = module.lambda_cards_get.invoke_arn
}

output "lambda_cards_delete_arn" {
  description = "ARN of the cards_delete Lambda function"
  value       = module.lambda_cards_delete.function_arn
}

output "lambda_cards_delete_invoke_arn" {
  description = "Invoke ARN of the cards_delete Lambda function"
  value       = module.lambda_cards_delete.invoke_arn
}

output "lambda_cards_revalue_arn" {
  description = "ARN of the cards_revalue Lambda function"
  value       = module.lambda_cards_revalue.function_arn
}

output "lambda_cards_revalue_invoke_arn" {
  description = "Invoke ARN of the cards_revalue Lambda function"
  value       = module.lambda_cards_revalue.invoke_arn
}

# ============================================================================
# Orchestration Lambda Outputs
# ============================================================================

output "lambda_rekognition_extract_arn" {
  description = "ARN of the rekognition_extract Lambda function"
  value       = module.lambda_rekognition_extract.function_arn
}

output "lambda_pricing_agent_arn" {
  description = "ARN of the pricing_agent Lambda function"
  value       = module.lambda_pricing_agent.function_arn
}

output "lambda_authenticity_agent_arn" {
  description = "ARN of the authenticity_agent Lambda function"
  value       = module.lambda_authenticity_agent.function_arn
}

output "lambda_aggregator_arn" {
  description = "ARN of the aggregator Lambda function"
  value       = module.lambda_aggregator.function_arn
}

output "lambda_error_handler_arn" {
  description = "ARN of the error_handler Lambda function"
  value       = module.lambda_error_handler.function_arn
}
