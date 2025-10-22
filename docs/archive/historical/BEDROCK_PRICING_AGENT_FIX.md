# Bedrock Pricing Agent Permission Fix

## Issue

The Pricing Agent was failing to generate AI-powered valuation summaries with the error:

```
User: arn:aws:sts::825478277761:assumed-role/collectiq-hackathon-pricing-agent-role/collectiq-hackathon-pricing-agent
is not authorized to perform: bedrock:InvokeModel on resource:
arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0
```

## Root Cause

The Pricing Agent Lambda function was missing the Bedrock access IAM policy. Only the OCR Reasoning Agent and Authenticity Agent had the policy attached.

The Pricing Agent needs Bedrock access to generate AI-powered valuation summaries using Claude Sonnet 4.

## Solution

Added the Bedrock access policy to the Pricing Agent Lambda configuration.

### Changes Made

**File**: `infra/terraform/envs/hackathon/lambdas.tf`

1. Added `BEDROCK_MODEL_ID` environment variable:

   ```hcl
   BEDROCK_MODEL_ID = "us.anthropic.claude-sonnet-4-20250514-v1:0"
   ```

2. Added Bedrock access policy to `additional_policy_arns`:

   ```hcl
   additional_policy_arns = [module.bedrock_access.policy_arn]
   ```

3. Updated IAM permissions documentation in comments

## Agents Using Bedrock

After this fix, all three AI agents have Bedrock access:

1. **OCR Reasoning Agent** - Interprets OCR text and extracts card metadata
2. **Authenticity Agent** - Analyzes card authenticity and detects fakes
3. **Pricing Agent** - Generates AI-powered valuation summaries

All three use the same cross-region inference profile: `us.anthropic.claude-sonnet-4-20250514-v1:0`

## Deployment

Run `terraform apply` to update the Pricing Agent's IAM role with Bedrock permissions:

```bash
cd infra/terraform/envs/hackathon
terraform apply
```

No code changes required - the Pricing Agent code already has Bedrock integration, it just needed the IAM permissions.

## Verification

After deployment, test by uploading a card image. The pricing result should include:

```json
{
  "valuationSummary": {
    "summary": "Based on X recent sales, this card is valued between $Y and $Z...",
    "fairValue": 25.5,
    "trend": "increasing",
    "recommendation": "Strong buy opportunity at current market prices.",
    "confidence": 0.85
  }
}
```

Instead of the fallback message:

```json
{
  "valuationSummary": {
    "summary": "Based on 0 recent sales, this card is valued between $0.00 and $0.00. AI analysis unavailable.",
    "fairValue": 0,
    "trend": "stable",
    "recommendation": "Manual review recommended for accurate valuation.",
    "confidence": 0.3
  }
}
```
