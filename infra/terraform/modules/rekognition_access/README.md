# Rekognition Access Module

This module creates an IAM policy for Amazon Rekognition access with S3 read permissions.

## Features

- IAM policy for `rekognition:DetectText`
- IAM policy for `rekognition:DetectLabels`
- S3 read access scoped to uploads bucket
- Optional S3 read access for authentic samples bucket

## Usage

```hcl
module "rekognition_access" {
  source = "../../modules/rekognition_access"

  policy_name        = "collectiq-hackathon-rekognition-access"
  policy_description = "Rekognition access for card image analysis"

  uploads_bucket_arn = module.s3_uploads.bucket_arn
  samples_bucket_arn = module.s3_samples.bucket_arn

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}

# Attach to Lambda execution role
resource "aws_iam_role_policy_attachment" "rekognition_lambda" {
  role       = module.rekognition_extract_lambda.role_name
  policy_arn = module.rekognition_access.policy_arn
}
```

## Permissions Granted

### Rekognition

- `rekognition:DetectText` - Extract text from card images
- `rekognition:DetectLabels` - Detect visual features and labels

### S3

- `s3:GetObject` on `{uploads_bucket_arn}/*` - Read uploaded card images
- `s3:GetObject` on `{samples_bucket_arn}/*` - Read authentic reference samples (optional)

## Inputs

| Name               | Description            | Type   | Default                   | Required |
| ------------------ | ---------------------- | ------ | ------------------------- | -------- |
| policy_name        | Name of the IAM policy | string | "RekognitionAccessPolicy" | no       |
| uploads_bucket_arn | Uploads bucket ARN     | string | -                         | yes      |
| samples_bucket_arn | Samples bucket ARN     | string | ""                        | no       |

## Outputs

| Name        | Description     |
| ----------- | --------------- |
| policy_arn  | IAM policy ARN  |
| policy_name | IAM policy name |
