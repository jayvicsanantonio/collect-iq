# DynamoDB CollectIQ Module

This module provisions a DynamoDB table with single-table design for CollectIQ card data.

## Features

- Single-table design with PK and SK
- GSI1 for vault listings (userId + createdAt)
- GSI2 for analytics (set#rarity + valueMedian)
- On-demand billing mode for variable workloads
- Point-in-time recovery enabled
- Encryption at rest with AWS managed keys
- TTL for automatic expiration of cached data

## Schema Design

### Primary Key

- **PK**: `USER#{sub}` - User-scoped partition key
- **SK**: `CARD#{cardId}` or `PRICE#{iso8601}` - Entity type and identifier

### GSI1: Vault Listings

- **Hash Key**: `userId`
- **Range Key**: `createdAt`
- **Use Case**: Query all cards for a user sorted by creation date

### GSI2: Analytics

- **Hash Key**: `setRarity` (e.g., `base-set#rare`)
- **Range Key**: `valueMedian`
- **Use Case**: Query cards by set and rarity sorted by value

## Usage

```hcl
module "dynamodb" {
  source = "../../modules/dynamodb_collectiq"

  table_name   = "hackathon-CollectIQ"
  billing_mode = "PAY_PER_REQUEST"

  gsi1_name = "GSI1"
  gsi2_name = "GSI2"

  enable_point_in_time_recovery = true
  enable_ttl                     = true
  ttl_attribute                  = "ttl"

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}
```

## Inputs

| Name                          | Description                | Type   | Default           | Required |
| ----------------------------- | -------------------------- | ------ | ----------------- | -------- |
| table_name                    | Name of the DynamoDB table | string | -                 | yes      |
| billing_mode                  | Billing mode               | string | "PAY_PER_REQUEST" | no       |
| enable_point_in_time_recovery | Enable PITR                | bool   | true              | no       |
| enable_ttl                    | Enable TTL                 | bool   | true              | no       |

## Outputs

| Name       | Description         |
| ---------- | ------------------- |
| table_name | DynamoDB table name |
| table_arn  | DynamoDB table ARN  |
| gsi1_name  | GSI1 name           |
| gsi2_name  | GSI2 name           |
