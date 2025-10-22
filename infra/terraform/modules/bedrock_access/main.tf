data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

locals {
  # Convert model IDs to ARNs if model_arns is empty
  # Supports both foundation models and inference profiles
  # Inference profiles use format: us.anthropic.claude-sonnet-4-20250514-v1:0
  # Foundation models use format: anthropic.claude-3-5-sonnet-20240620-v1:0
  # Note: When using inference profiles, AWS requires permissions for:
  # 1. The inference profile itself (both account-less and account-specific)
  # 2. The underlying foundation model (SDK resolves to this internally)
  computed_model_arns = length(var.model_arns) > 0 ? var.model_arns : flatten([
    for model_id in var.model_ids : (
      startswith(model_id, "us.") || startswith(model_id, "eu.") || startswith(model_id, "apac.") || startswith(model_id, "jp.") ?
      [
        # Inference profile ARNs (account-less)
        "arn:aws:bedrock:${data.aws_region.current.name}::inference-profile/${model_id}",
        # Inference profile ARNs (account-specific - SDK may resolve to this)
        "arn:aws:bedrock:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:inference-profile/${model_id}",
        # Underlying foundation model ARN (required - SDK resolves inference profile to this)
        # Extract base model ID by removing region prefix (us., eu., etc.)
        "arn:aws:bedrock:${data.aws_region.current.name}::foundation-model/${replace(model_id, "/^(us|eu|apac|jp|global)\\./", "")}"
      ] :
      [
        # Foundation model ARN (always account-less)
        "arn:aws:bedrock:${data.aws_region.current.name}::foundation-model/${model_id}"
      ]
    )
  ])
}

data "aws_iam_policy_document" "bedrock_access" {
  # Allow Bedrock InvokeModel for specified models only
  # Follows least-privilege principle by restricting to specific model ARNs
  # rather than granting wildcard access to all Bedrock models
  statement {
    sid    = "AllowBedrockInvokeModel"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel"
    ]
    resources = local.computed_model_arns
  }

  # Allow Bedrock InvokeModelWithResponseStream for streaming responses
  # Also restricted to specific model ARNs for least-privilege access
  statement {
    sid    = "AllowBedrockInvokeModelStream"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = local.computed_model_arns
  }

  # Allow Bedrock Converse API for conversational model interactions
  # Required for ConverseCommand and ConverseStreamCommand
  statement {
    sid    = "AllowBedrockConverse"
    effect = "Allow"
    actions = [
      "bedrock:Converse",
      "bedrock:ConverseStream"
    ]
    resources = local.computed_model_arns
  }
}

resource "aws_iam_policy" "bedrock_access" {
  name        = var.policy_name
  description = var.policy_description
  policy      = data.aws_iam_policy_document.bedrock_access.json

  tags = var.tags
}
