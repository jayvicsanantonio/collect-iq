resource "aws_dynamodb_table" "table" {
  name         = var.table_name
  billing_mode = var.billing_mode

  # Hash key (partition key)
  hash_key = "PK"
  # Range key (sort key)
  range_key = "SK"

  # Primary key attributes
  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1 attributes for vault listings (userId + createdAt)
  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # GSI2 attributes for analytics (set#rarity + valueMedian)
  attribute {
    name = "setRarity"
    type = "S"
  }

  attribute {
    name = "valueMedian"
    type = "N"
  }

  # GSI1: Query cards by userId sorted by createdAt
  global_secondary_index {
    name            = var.gsi1_name
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # GSI2: Query cards by set#rarity sorted by valueMedian
  global_secondary_index {
    name            = var.gsi2_name
    hash_key        = "setRarity"
    range_key       = "valueMedian"
    projection_type = "ALL"
  }

  # Point-in-time recovery for disaster recovery
  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  # Server-side encryption at rest
  server_side_encryption {
    enabled     = true
    kms_key_arn = var.kms_key_arn
  }

  # TTL for automatic expiration of cached pricing data
  ttl {
    attribute_name = var.ttl_attribute
    enabled        = var.enable_ttl
  }

  tags = var.tags
}
