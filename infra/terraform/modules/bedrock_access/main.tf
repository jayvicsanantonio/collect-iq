data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

locals {
  # Convert model IDs to ARNs if model_arns is empty
  # This follows the least-privilege principle by restricting access to specific models
  computed_model_arns = length(var.model_arns) > 0 ? var.model_arns : [
    for model_id in var.model_ids :
    "arn:aws:bedrock:${data.aws_region.current.name}::foundation-model/${model_id}"
  ]
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
}

resource "aws_iam_policy" "bedrock_access" {
  name        = var.policy_name
  description = var.policy_description
  policy      = data.aws_iam_policy_document.bedrock_access.json

  tags = var.tags
}
