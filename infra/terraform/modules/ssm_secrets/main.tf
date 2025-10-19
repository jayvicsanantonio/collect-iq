resource "aws_secretsmanager_secret" "secrets" {
  for_each = var.secrets

  name        = each.value.name
  description = each.value.description

  tags = merge(
    var.tags,
    {
      Name = each.value.name
    }
  )
}

# Secret versions (initial placeholder values)
resource "aws_secretsmanager_secret_version" "secrets" {
  for_each = var.secrets

  secret_id     = aws_secretsmanager_secret.secrets[each.key].id
  secret_string = each.value.initial_value != null ? each.value.initial_value : jsonencode({
    placeholder = "REPLACE_WITH_ACTUAL_VALUE"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# IAM policy for reading secrets
data "aws_iam_policy_document" "secrets_read" {
  statement {
    sid    = "AllowSecretsManagerGetSecretValue"
    effect = "Allow"
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ]
    resources = [
      for secret in aws_secretsmanager_secret.secrets : secret.arn
    ]
  }
}

resource "aws_iam_policy" "secrets_read" {
  name        = var.policy_name
  description = var.policy_description
  policy      = data.aws_iam_policy_document.secrets_read.json

  tags = var.tags
}
