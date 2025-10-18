resource "aws_s3_bucket" "uploads" {
  bucket = var.bucket_name

  tags = var.tags
}

# Block all public access
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-side encryption with SSE-S3
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Versioning for data protection
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = var.enable_versioning ? "Enabled" : "Suspended"
  }
}

# Bucket policy enforcing HTTPS
resource "aws_s3_bucket_policy" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnforceSSLOnly"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# CORS configuration for presigned URLs
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  cors_rule {
    allowed_headers = var.cors_allowed_headers
    allowed_methods = var.cors_allowed_methods
    allowed_origins = var.cors_allowed_origins
    expose_headers  = var.cors_expose_headers
    max_age_seconds = var.cors_max_age_seconds
  }
}

# Lifecycle configuration
#resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
#  bucket = aws_s3_bucket.uploads.id
#
#  # Transition uploads to Glacier after 90 days, delete after 365 days
#  rule {
#    id     = "uploads-lifecycle"
#    status = "Enabled"
#
#    filter {
#      prefix = "uploads/"
#    }
#
#    transition {
#      days          = var.glacier_transition_days
#      storage_class = "GLACIER"
#    }
#
#    expiration {
#      days = var.expiration_days
#    }
#
#    noncurrent_version_expiration {
#      noncurrent_days = 30
#    }
#  }
#
#  # Keep authentic-samples without expiration
#  rule {
#    id     = "authentic-samples-retention"
#    status = "Enabled"
#
#    filter {
#      prefix = "authentic-samples/"
#    }
#
#    # No transitions or expiration for reference samples
#  }
#}
