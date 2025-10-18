# Secrets Manager Module

This module creates AWS Secrets Manager secrets for external API keys with automatic rotation support.

## Features

- AWS Secrets Manager secrets for external API keys
- Optional automatic rotation schedules
- IAM policy for reading secrets
- Lifecycle management to prevent accidental overwrites
- Initial placeholder values

## Usage

```hcl
module "ssm_secrets" {
  source = "../../modules/ssm_secrets"

  secrets = {
    ebay_api_key = {
      name          = "collectiq/hackathon/ebay-api-key"
      description   = "eBay API key for pricing data"
      rotation_days = null # Manual rotation
      initial_value = null # Will use placeholder
    }
    tcgplayer_keys = {
      name        = "collectiq/hackathon/tcgplayer-keys"
      description = "TCGPlayer public and private keys"
      initial_value = jsonencode({
        public_key  = "REPLACE_WITH_PUBLIC_KEY"
        private_key = "REPLACE_WITH_PRIVATE_KEY"
      })
      rotation_days = null
    }
    pricecharting_api_key = {
      name          = "collectiq/hackathon/pricecharting-api-key"
      description   = "PriceCharting API key"
      rotation_days = null
      initial_value = null
    }
  }

  policy_name        = "collectiq-hackathon-secrets-read"
  policy_description = "Read access to CollectIQ API keys"

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}

# Attach to Lambda execution role
resource "aws_iam_role_policy_attachment" "secrets_lambda" {
  role       = module.pricing_agent_lambda.role_name
  policy_arn = module.ssm_secrets.policy_arn
}
```

## Updating Secret Values

After Terraform creates the secrets with placeholder values, update them manually:

```bash
# Update eBay API key
aws secretsmanager put-secret-value \
  --secret-id collectiq/hackathon/ebay-api-key \
  --secret-string "your-actual-api-key"

# Update TCGPlayer keys
aws secretsmanager put-secret-value \
  --secret-id collectiq/hackathon/tcgplayer-keys \
  --secret-string '{"public_key":"actual-public","private_key":"actual-private"}'

# Update PriceCharting API key
aws secretsmanager put-secret-value \
  --secret-id collectiq/hackathon/pricecharting-api-key \
  --secret-string "your-actual-api-key"
```

## Automatic Rotation

For secrets that support automatic rotation, set `rotation_days`:

```hcl
rotation_days = 30  # Rotate every 30 days
```

Note: Automatic rotation requires a Lambda function to perform the rotation. This is typically provider-specific.

## Inputs

| Name        | Description              | Type        | Default                    | Required |
| ----------- | ------------------------ | ----------- | -------------------------- | -------- |
| secrets     | Map of secrets to create | map(object) | {}                         | yes      |
| policy_name | IAM policy name          | string      | "SecretsManagerReadPolicy" | no       |

## Outputs

| Name         | Description                        |
| ------------ | ---------------------------------- |
| secret_arns  | Map of secret ARNs                 |
| secret_names | Map of secret names                |
| policy_arn   | IAM policy ARN for reading secrets |

## Security Best Practices

1. Never commit actual API keys to version control
2. Use placeholder values in Terraform
3. Update secrets manually via AWS CLI or Console
4. Enable CloudTrail logging for secret access
5. Use least-privilege IAM policies
6. Rotate secrets regularly
