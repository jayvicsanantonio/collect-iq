# S3 Authenticity Agent Permission Fix

## Issue

The Authenticity Agent was failing to load reference hash files from S3 with the error:

```
User: arn:aws:sts::825478277761:assumed-role/collectiq-hackathon-authenticity-agent-role/collectiq-hackathon-authenticity-agent
is not authorized to perform: s3:ListBucket on resource:
"arn:aws:s3:::collectiq-hackathon-uploads-825478277761"
```

## Root Cause

The Authenticity Agent needs to:

1. List reference hash files in S3 (requires `s3:ListBucket` on bucket)
2. Read those files (requires `s3:GetObject` on objects)

The IAM policy only granted `s3:GetObject` but not `s3:ListBucket`.

## What the Authenticity Agent Does

The agent compares uploaded card images against reference hashes of authentic cards stored in S3:

1. User uploads a card image (e.g., "Empoleon V")
2. Agent computes perceptual hash of the uploaded image
3. Agent lists reference hashes from S3: `s3://bucket/authentic-samples/Empoleon V/*.hash`
4. Agent compares uploaded hash against reference hashes
5. Returns authenticity score based on similarity

Without `s3:ListBucket`, the agent can't find reference files, so it falls back to basic visual analysis only.

## Solution

Updated the `rekognition_extract_s3` IAM policy document to include `s3:ListBucket` permission.

### Changes Made

**File**: `infra/terraform/envs/hackathon/lambdas.tf`

Added a new statement to the policy:

```hcl
statement {
  effect = "Allow"
  actions = [
    "s3:ListBucket"
  ]
  resources = [
    module.s3_uploads.bucket_arn
  ]
}
```

This policy is shared by:

- **Rekognition Extract Lambda** - Reads uploaded images for feature extraction
- **Authenticity Agent Lambda** - Reads uploaded images AND lists/reads reference hashes

## Deployment

Run `terraform apply` to update the IAM policies:

```bash
cd infra/terraform/envs/hackathon
terraform apply
```

## Verification

After deployment, the Authenticity Agent should successfully:

1. List reference hash files from S3
2. Compare uploaded card against reference hashes
3. Return detailed authenticity analysis

Check CloudWatch logs for:

```json
{
  "level": "INFO",
  "message": "Reference hashes loaded",
  "cardName": "Empoleon V",
  "hashCount": 5
}
```

Instead of:

```json
{
  "level": "ERROR",
  "message": "Failed to load reference hashes",
  "error": "AccessDenied: ... s3:ListBucket ..."
}
```

## Note on Reference Hashes

The reference hash feature is optional. If no reference hashes exist in S3, the agent will:

- Log a warning about missing reference data
- Fall back to visual feature analysis only
- Still return an authenticity score based on:
  - Holographic variance
  - Border symmetry
  - Print quality
  - Text clarity
  - AI-powered analysis via Bedrock

To populate reference hashes, upload authentic card samples to:

```
s3://collectiq-hackathon-uploads-825478277761/authentic-samples/{CardName}/
```
