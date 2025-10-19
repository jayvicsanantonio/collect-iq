# Step Functions Module

This module provisions AWS Step Functions state machine for multi-agent orchestration.

## Features

- Standard or Express workflow types
- IAM role with Lambda invoke permissions
- CloudWatch Logs for execution history
- X-Ray tracing enabled by default
- Custom IAM policies support
- Configurable logging levels

## Usage

```hcl
module "step_functions" {
  source = "../../modules/step_functions"

  state_machine_name = "collectiq-hackathon-valuation"
  state_machine_type = "STANDARD"

  definition = jsonencode({
    Comment = "CollectIQ Multi-Agent Valuation Workflow"
    StartAt = "RekognitionExtract"
    States = {
      RekognitionExtract = {
        Type     = "Task"
        Resource = module.rekognition_extract_lambda.function_arn
        Next     = "ParallelAgents"
        Retry = [
          {
            ErrorEquals     = ["States.TaskFailed"]
            IntervalSeconds = 2
            MaxAttempts     = 3
            BackoffRate     = 2.0
          }
        ]
      }
      ParallelAgents = {
        Type = "Parallel"
        Branches = [
          {
            StartAt = "PricingAgent"
            States = {
              PricingAgent = {
                Type     = "Task"
                Resource = module.pricing_agent_lambda.function_arn
                End      = true
              }
            }
          },
          {
            StartAt = "AuthenticityAgent"
            States = {
              AuthenticityAgent = {
                Type     = "Task"
                Resource = module.authenticity_agent_lambda.function_arn
                End      = true
              }
            }
          }
        ]
        Next = "Aggregator"
      }
      Aggregator = {
        Type     = "Task"
        Resource = module.aggregator_lambda.function_arn
        End      = true
      }
    }
  })

  lambda_function_arns = [
    module.rekognition_extract_lambda.function_arn,
    module.pricing_agent_lambda.function_arn,
    module.authenticity_agent_lambda.function_arn,
    module.aggregator_lambda.function_arn
  ]

  enable_xray_tracing        = true
  log_level                  = "ERROR"
  log_include_execution_data = false

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}
```

## State Machine Types

- **STANDARD**: Long-running workflows (up to 1 year), exactly-once execution, full execution history
- **EXPRESS**: Short-duration workflows (up to 5 minutes), at-least-once execution, lower cost

## Inputs

| Name                 | Description                | Type         | Default    | Required |
| -------------------- | -------------------------- | ------------ | ---------- | -------- |
| state_machine_name   | Name of the state machine  | string       | -          | yes      |
| definition           | ASL definition (JSON)      | string       | -          | yes      |
| state_machine_type   | Type (STANDARD or EXPRESS) | string       | "STANDARD" | no       |
| lambda_function_arns | Lambda ARNs to invoke      | list(string) | []         | no       |
| enable_xray_tracing  | Enable X-Ray               | bool         | true       | no       |
| log_level            | Log level                  | string       | "ERROR"    | no       |

## Outputs

| Name              | Description               |
| ----------------- | ------------------------- |
| state_machine_arn | State machine ARN         |
| role_arn          | Execution role ARN        |
| log_group_name    | CloudWatch log group name |
