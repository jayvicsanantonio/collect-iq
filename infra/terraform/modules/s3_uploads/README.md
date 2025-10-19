# S3 Uploads Module

This module provisions an S3 bucket for secure card image uploads with presigned URL support.

## Features

- Block all public access
- Server-side encryption (SSE-S3)
- Versioning enabled for data protection
- HTTPS-only access enforced via bucket policy
- CORS configuration for presigned PUT requests
- Lifecycle policies (Glacier after 90 days, delete after 365 days)
- Separate retention for authentic-samples

## Usage

```hcl
module "s3_uploads" {
  source = "../../modules/s3_uploads"

  bucket_name = "hackathon-collectiq-uploads-${data.aws_caller_identity.current.account_id}"

  cors_allowed_origins = ["https://app.example.com"]

  glacier_transition_days = 90
  expiration_days         = 365

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}
```

## Bucket Structure

```
bucket/
├── uploads/{userId}/{uuid}       # User uploads (lifecycle managed)
└── authentic-samples/{set}/{id}  # Reference samples (no expiration)
```

## Lifecycle Policies

- **uploads/**: Transition to Glacier after 90 days, delete after 365 days
- **authentic-samples/**: No expiration (permanent retention)

## Security

- All public access blocked
- HTTPS-only access enforced
- Server-side encryption enabled
- Versioning enabled for recovery

## Inputs

| Name                    | Description           | Type         | Default | Required |
| ----------------------- | --------------------- | ------------ | ------- | -------- |
| bucket_name             | Name of the S3 bucket | string       | -       | yes      |
| cors_allowed_origins    | CORS allowed origins  | list(string) | ["*"]   | no       |
| glacier_transition_days | Days before Glacier   | number       | 90      | no       |
| expiration_days         | Days before deletion  | number       | 365     | no       |

## Outputs

| Name        | Description    |
| ----------- | -------------- |
| bucket_name | S3 bucket name |
| bucket_arn  | S3 bucket ARN  |
