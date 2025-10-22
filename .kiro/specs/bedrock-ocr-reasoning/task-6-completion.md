# Task 6 Completion: Add Lambda Function Infrastructure

## Summary

Successfully added the OCR Reasoning Agent Lambda function infrastructure to the Terraform configuration. The Lambda function is configured to invoke Amazon Bedrock (Claude Sonnet 4.0) for intelligent OCR interpretation.

## Changes Made

### 1. Lambda Deployment Package Configuration

Added data source for the OCR reasoning agent deployment package in `infra/terraform/envs/hackathon/lambdas.tf`:

```hcl
data "archive_file" "ocr_reasoning_agent" {
  type        = "zip"
  source_file = "${path.module}/../../../../services/backend/dist/agents/ocr-reasoning-agent.mjs"
  output_path = "${path.module}/.terraform/lambda-packages/ocr-reasoning-agent.zip"
}
```

### 2. Lambda Function Module

Added Lambda function module configuration with the following specifications:

- **Function Name**: `collectiq-ocr-reasoning-agent-${var.environment}`
- **Runtime**: Node.js 20 (`nodejs20.x`)
- **Memory**: 512 MB
- **Timeout**: 30 seconds
- **Handler**: `ocr-reasoning-agent.handler`
- **VPC**: Configured with private subnets and Lambda security group
- **Log Retention**: 7 days (as specified in requirements)

### 3. Environment Variables

Configured the following environment variables for Bedrock integration:

- `REGION`: AWS region for Bedrock API calls
- `BEDROCK_MODEL_ID`: `anthropic.claude-sonnet-4-20250514-v1:0`
- `BEDROCK_TEMPERATURE`: `0.15` (low for deterministic outputs)
- `BEDROCK_MAX_TOKENS`: `4096` (sufficient for detailed reasoning)
- `BEDROCK_MAX_RETRIES`: `3` (exponential backoff retry logic)
- `XRAY_ENABLED`: `false` (disabled to avoid context issues)

### 4. IAM Permissions

Attached the Bedrock access policy to the Lambda execution role:

- Uses the existing `module.bedrock_access.policy_arn`
- Grants `bedrock:InvokeModel` permission for Claude Sonnet 4.0
- Follows least-privilege principle

### 5. CloudWatch Logs

Configured CloudWatch log group with:

- Log group name: `/aws/lambda/collectiq-ocr-reasoning-agent-${var.environment}`
- Retention: 7 days (as specified in task requirements)
- Automatic creation via Lambda module

### 6. Outputs

Added Terraform output for the Lambda function ARN:

```hcl
output "lambda_ocr_reasoning_agent_arn" {
  description = "ARN of the ocr_reasoning_agent Lambda function"
  value       = module.lambda_ocr_reasoning_agent.function_arn
}
```

## Configuration Details

### Lambda Module Configuration

```hcl
module "lambda_ocr_reasoning_agent" {
  source = "../../modules/lambda_fn"

  function_name = "${local.name_prefix}-ocr-reasoning-agent"
  description   = "Interpret OCR results using Amazon Bedrock (Claude Sonnet 4.0)"
  filename      = data.archive_file.ocr_reasoning_agent.output_path
  source_code_hash = data.archive_file.ocr_reasoning_agent.output_base64sha256
  handler       = "ocr-reasoning-agent.handler"
  runtime       = "nodejs20.x"

  memory_size = 512
  timeout     = 30

  # VPC Configuration
  vpc_subnet_ids         = module.vpc.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.lambda.id]

  environment_variables = {
    REGION           = var.aws_region
    BEDROCK_MODEL_ID = "anthropic.claude-sonnet-4-20250514-v1:0"
    BEDROCK_TEMPERATURE = "0.15"
    BEDROCK_MAX_TOKENS  = "4096"
    BEDROCK_MAX_RETRIES = "3"
    XRAY_ENABLED     = "false"
  }

  additional_policy_arns = [module.bedrock_access.policy_arn]

  enable_xray_tracing = false
  log_retention_days  = 7

  tags = local.common_tags
}
```

## Requirements Satisfied

✅ **Requirement 1.3**: Lambda execution role has Bedrock invoke permissions via `module.bedrock_access.policy_arn`

✅ **Requirement 1.4**: Configured with:

- Runtime: Node.js 20
- Memory: 512 MB
- Timeout: 30 seconds
- Environment variables for Bedrock model ID and configuration

✅ **Requirement 1.5**:

- VPC configuration included (private subnets + security group)
- CloudWatch log group with 7-day retention
- IAM permissions follow least-privilege principle

## Next Steps

1. **Build Backend**: Run `pnpm build` in `services/backend/` to compile the handler
2. **Deploy Infrastructure**: Run `terraform apply` in `infra/terraform/envs/hackathon/`
3. **Verify Deployment**: Check Lambda function in AWS Console
4. **Update Step Functions**: Integrate OCR reasoning agent into workflow (Task 5)
5. **Test Integration**: Invoke Lambda with sample OCR data

## Notes

- The Lambda function uses the existing Bedrock access module, which already grants permissions for Claude Sonnet 4.0
- VPC configuration ensures the Lambda can access AWS services while maintaining security
- X-Ray tracing is disabled to avoid context issues with module-level SDK initialization (consistent with other Lambda functions)
- Log retention is set to 7 days as specified in the task requirements (shorter than the default 30 days for other functions)
