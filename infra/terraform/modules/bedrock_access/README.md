# Bedrock Access Module

This module creates an IAM policy for Amazon Bedrock model invocation.

## Features

- IAM policy for `bedrock:InvokeModel`
- IAM policy for `bedrock:InvokeModelWithResponseStream`
- Scoped to specific model ARNs (Claude 3 Sonnet by default)
- Automatic ARN generation from model IDs

## Usage

```hcl
module "bedrock_access" {
  source = "../../modules/bedrock_access"

  policy_name        = "collectiq-hackathon-bedrock-access"
  policy_description = "Bedrock access for AI-powered valuation and authenticity"

  # Option 1: Use default model IDs (Claude 3 Sonnet)
  model_ids = [
    "anthropic.claude-3-sonnet-20240229-v1:0",
    "anthropic.claude-3-5-sonnet-20240620-v1:0"
  ]

  # Option 2: Provide explicit model ARNs
  # model_arns = [
  #   "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
  # ]

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}

# Attach to Lambda execution role
resource "aws_iam_role_policy_attachment" "bedrock_lambda" {
  role       = module.authenticity_agent_lambda.role_name
  policy_arn = module.bedrock_access.policy_arn
}
```

## Supported Models

### Claude 3 Family

- `anthropic.claude-3-sonnet-20240229-v1:0` - Claude 3 Sonnet
- `anthropic.claude-3-5-sonnet-20240620-v1:0` - Claude 3.5 Sonnet
- `anthropic.claude-3-haiku-20240307-v1:0` - Claude 3 Haiku
- `anthropic.claude-3-opus-20240229-v1:0` - Claude 3 Opus

## Permissions Granted

### Bedrock

- `bedrock:InvokeModel` - Invoke foundation models
- `bedrock:InvokeModelWithResponseStream` - Invoke models with streaming responses

## Inputs

| Name        | Description                              | Type         | Default               | Required |
| ----------- | ---------------------------------------- | ------------ | --------------------- | -------- |
| policy_name | Name of the IAM policy                   | string       | "BedrockAccessPolicy" | no       |
| model_ids   | List of model IDs                        | list(string) | Claude 3 Sonnet       | no       |
| model_arns  | List of model ARNs (overrides model_ids) | list(string) | []                    | no       |

## Outputs

| Name        | Description                       |
| ----------- | --------------------------------- |
| policy_arn  | IAM policy ARN                    |
| policy_name | IAM policy name                   |
| model_arns  | List of model ARNs granted access |
