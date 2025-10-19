data "aws_iam_policy_document" "rekognition_access" {
  # Allow Rekognition DetectText
  statement {
    sid    = "AllowRekognitionDetectText"
    effect = "Allow"
    actions = [
      "rekognition:DetectText"
    ]
    resources = ["*"]
  }

  # Allow Rekognition DetectLabels
  statement {
    sid    = "AllowRekognitionDetectLabels"
    effect = "Allow"
    actions = [
      "rekognition:DetectLabels"
    ]
    resources = ["*"]
  }

  # Allow S3 GetObject for uploads bucket
  statement {
    sid    = "AllowS3GetObjectUploads"
    effect = "Allow"
    actions = [
      "s3:GetObject"
    ]
    resources = [
      "${var.uploads_bucket_arn}/*"
    ]
  }

  # Allow S3 GetObject for authentic samples bucket (if provided)
  dynamic "statement" {
    for_each = var.samples_bucket_arn != "" ? [1] : []
    content {
      sid    = "AllowS3GetObjectSamples"
      effect = "Allow"
      actions = [
        "s3:GetObject"
      ]
      resources = [
        "${var.samples_bucket_arn}/*"
      ]
    }
  }
}

resource "aws_iam_policy" "rekognition_access" {
  name        = var.policy_name
  description = var.policy_description
  policy      = data.aws_iam_policy_document.rekognition_access.json

  tags = var.tags
}
