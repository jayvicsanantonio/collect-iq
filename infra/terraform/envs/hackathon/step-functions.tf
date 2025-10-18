# Step Functions State Machine Configuration for Hackathon Environment
# This file defines the multi-agent orchestration workflow

# ============================================================================
# State Machine Definition with Lambda ARN Substitution
# ============================================================================

locals {
  # Read the ASL definition template
  state_machine_definition_template = file("${path.module}/state-machine-definition.json")
  
  # Substitute Lambda ARNs into the template
  state_machine_definition = replace(
    replace(
      replace(
        replace(
          replace(
            local.state_machine_definition_template,
            "$${rekognition_extract_lambda_arn}",
            module.lambda_rekognition_extract.function_arn
          ),
          "$${pricing_agent_lambda_arn}",
          module.lambda_pricing_agent.function_arn
        ),
        "$${authenticity_agent_lambda_arn}",
        module.lambda_authenticity_agent.function_arn
      ),
      "$${aggregator_lambda_arn}",
      module.lambda_aggregator.function_arn
    ),
    "$${error_handler_lambda_arn}",
    module.lambda_error_handler.function_arn
  )
}

# ============================================================================
# Step Functions State Machine Module
# ============================================================================

module "step_functions" {
  source = "../../modules/step_functions"

  state_machine_name = "${local.name_prefix}-card-valuation"
  definition         = local.state_machine_definition
  state_machine_type = "STANDARD" # Use STANDARD for auditability and long-running workflows

  # Grant permissions to invoke all Lambda functions in the workflow
  lambda_function_arns = [
    module.lambda_rekognition_extract.function_arn,
    module.lambda_pricing_agent.function_arn,
    module.lambda_authenticity_agent.function_arn,
    module.lambda_aggregator.function_arn,
    module.lambda_error_handler.function_arn
  ]

  # Enable X-Ray tracing for distributed tracing
  enable_xray_tracing = true

  # CloudWatch Logs configuration
  log_level                  = "ERROR" # Log errors only for cost optimization
  log_include_execution_data = false   # Don't log full execution data for cost optimization
  log_retention_days         = 30

  tags = local.common_tags
}

# ============================================================================
# Notes on Lambda Environment Variables
# ============================================================================

# The cards_revalue Lambda environment variable STEP_FUNCTIONS_ARN is updated
# in lambdas.tf to reference module.step_functions.state_machine_arn
#
# The aggregator Lambda environment variable EVENT_BUS_NAME will be updated
# when EventBridge is deployed in a later task

