# OCR Agent Bedrock Permission Fix

## Problem

The OCR Reasoning Agent was consistently returning "AI reasoning unavailable" with fallback metadata because Bedrock API calls were failing with permission errors.

### Root Cause

The Lambda function uses the **Bedrock Converse API** (`ConverseCommand` from `@aws-sdk/client-bedrock-runtime`), but the IAM policy only granted:

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`

The Converse API requires different permissions:

- `bedrock:Converse`
- `bedrock:ConverseStream`

## Solution

Updated the Bedrock access IAM policy in `infra/terraform/modules/bedrock_access/main.tf` to include the missing permissions:

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

## Deployment Steps

1. Navigate to the Terraform environment:

   ```bash
   cd infra/terraform/envs/hackathon
   ```

2. Review the changes:

   ```bash
   terraform plan
   ```

3. Apply the updated IAM policy:

   ```bash
   terraform apply
   ```

4. The Lambda function will automatically pick up the new permissions (no code changes needed)

## Verification

After deployment, test the OCR agent by uploading a card image. The response should now include:

- `verifiedByAI: true`
- Proper card name extraction with high confidence
- Rarity, set, and other metadata fields populated
- Detailed reasoning trails from Claude

## Files Changed

- `infra/terraform/modules/bedrock_access/main.tf` - Added Converse API permissions
- `infra/terraform/envs/hackathon/lambdas.tf` - Updated IAM permission comments

## Related Code

The OCR agent code in `services/backend/src/adapters/bedrock-ocr-reasoning.ts` already has proper fallback logic, which is why the system continued to work (albeit with degraded functionality) when Bedrock calls failed.
