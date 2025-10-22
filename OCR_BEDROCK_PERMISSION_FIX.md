# OCR Agent Bedrock Fix

## Problem

The OCR Reasoning Agent was consistently returning "AI reasoning unavailable" with fallback metadata because Bedrock API calls were failing.

### Root Causes

1. **Missing Converse API Permissions**: The Lambda function uses the **Bedrock Converse API** (`ConverseCommand`), but the IAM policy only granted `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream`. The Converse API requires `bedrock:Converse` and `bedrock:ConverseStream`.

2. **Inference Profile Required**: AWS Bedrock now requires using **inference profiles** instead of direct model IDs for Claude Sonnet 4. The CloudWatch error was:
   > "Invocation of model ID anthropic.claude-sonnet-4-20250514-v1:0 with on-demand throughput isn't supported. Retry your request with the ID or ARN of an inference profile that contains this model."

## Solution

### 1. Added Converse API Permissions

Updated `infra/terraform/modules/bedrock_access/main.tf` to include:

```hcl
statement {
  sid    = "AllowBedrockConverse"
  effect = "Allow"
  actions = [
    "bedrock:Converse",
    "bedrock:ConverseStream"
  ]
  resources = local.computed_model_arns
}
```

### 2. Updated to Use Inference Profile

Changed model ID from:

- `anthropic.claude-sonnet-4-20250514-v1:0` (foundation model - not supported for on-demand)

To:

- `us.anthropic.claude-sonnet-4-20250514-v1:0` (cross-region inference profile)

Benefits of inference profiles:

- Required for on-demand throughput with Claude Sonnet 4
- Better availability with automatic cross-region failover
- No additional cost vs direct model access

### 3. Updated ARN Construction

Modified `infra/terraform/modules/bedrock_access/main.tf` to detect inference profiles and construct correct ARNs.

**Important Discovery**: The AWS SDK resolves cross-region inference profile IDs to BOTH account-less and account-specific ARNs. The IAM policy must include both formats:

```hcl
# For inference profile: us.anthropic.claude-sonnet-4-20250514-v1:0
# Need BOTH:
"arn:aws:bedrock:us-east-1::inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0"
"arn:aws:bedrock:us-east-1:825478277761:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0"
```

The Terraform module now generates both ARN formats for inference profiles to ensure compatibility.

## Files Changed

- `services/backend/src/adapters/bedrock-ocr-reasoning.ts` - Updated default model ID
- `infra/terraform/modules/bedrock_access/main.tf` - Added Converse permissions and inference profile ARN support
- `infra/terraform/modules/bedrock_access/variables.tf` - Updated default model ID
- `infra/terraform/envs/hackathon/main.tf` - Updated model ID configuration
- `infra/terraform/envs/hackathon/lambdas.tf` - Updated Lambda environment variables for both OCR and authenticity agents

## Deployment Steps

1. Navigate to the Terraform environment:

   ```bash
   cd infra/terraform/envs/hackathon
   ```

2. Review the changes:

   ```bash
   terraform plan
   ```

3. Apply the updated configuration:

   ```bash
   terraform apply
   ```

4. Rebuild and redeploy the Lambda function:
   ```bash
   cd ../../../services/backend
   pnpm build
   # Then redeploy via your CI/CD or manual Lambda update
   ```

## Verification

After deployment, test the OCR agent by uploading a card image. The response should now include:

- `verifiedByAI: true`
- Proper card name extraction with high confidence
- Rarity, set, and other metadata fields populated
- Detailed reasoning trails from Claude
- No "AI reasoning unavailable" fallback messages

Check CloudWatch logs for successful Bedrock invocations:

```bash
aws logs tail /aws/lambda/collectiq-hackathon-ocr-reasoning-agent --follow
```

Look for log entries like:

```json
{
  "level": "INFO",
  "message": "Bedrock invocation successful",
  "stopReason": "end_turn",
  "inputTokens": 1234,
  "outputTokens": 567
}
```
