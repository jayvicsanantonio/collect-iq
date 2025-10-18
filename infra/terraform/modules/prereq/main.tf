# S3 Bucket Creation
resource "aws_s3_bucket" "tf_state" {
  bucket = var.bucket_name
  lifecycle {
    prevent_destroy = true
  }
}

# S3 Bucket Encryption for Terraform State
resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state_encryption" {
  bucket = aws_s3_bucket.tf_state.bucket
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Ensure S3 Bucket Versioning is enabled
resource "aws_s3_bucket_versioning" "tf_state_versioning" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Ensure S3 Bucket is blocked from Public Access
resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  restrict_public_buckets = true
  ignore_public_acls      = true
  depends_on = [
    aws_s3_bucket.tf_state
  ]
}

# DynamoDB Creation
resource "aws_dynamodb_table" "terraform_state_lock" {
  depends_on   = [aws_s3_bucket.tf_state]
  name         = var.dynamodb_name
  hash_key     = "LockID"
  billing_mode = "PAY_PER_REQUEST"
  attribute {
    name = "LockID"
    type = "S"
  }
  point_in_time_recovery {
    enabled = true
  }  
}
