# CloudWatch Dashboards Module

This module creates comprehensive CloudWatch dashboards for monitoring CollectIQ infrastructure.

## Features

- API Performance Dashboard (4xx/5xx rates, latency)
- Lambda Performance Dashboard (invocations, errors, duration, throttles)
- Step Functions Dashboard (executions, timing)
- Data Layer Dashboard (DynamoDB, S3 metrics)
- AI Services Dashboard (Rekognition, Bedrock usage)

## Usage

```hcl
module "cloudwatch_dashboards" {
  source = "../../modules/cloudwatch_dashboards"

  dashboard_prefix = "collectiq-hackathon"

  lambda_function_names = [
    "collectiq-hackathon-upload-presign",
    "collectiq-hackathon-cards-create",
    "collectiq-hackathon-cards-list",
    "collectiq-hackathon-rekognition-extract",
    "collectiq-hackathon-pricing-agent",
    "collectiq-hackathon-authenticity-agent",
    "collectiq-hackathon-aggregator"
  ]

  step_functions_state_machine_name = "collectiq-hackathon-valuation"
  step_functions_state_machine_arn  = module.step_functions.state_machine_arn

  dynamodb_table_name = "hackathon-CollectIQ"
  s3_bucket_name      = "hackathon-collectiq-uploads"

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}
```

## Dashboards Created

### 1. API Performance Dashboard

- 4xx/5xx error rates
- Total request count
- Latency (Average, P50, P95, P99)

### 2. Lambda Performance Dashboard

- Invocations by function
- Errors by function
- Duration (average)
- Throttles

### 3. Step Functions Dashboard

- Execution counts (started, succeeded, failed, timed out)
- Execution time (average, P95)

### 4. Data Layer Dashboard

- DynamoDB read/write capacity units
- DynamoDB errors and throttles
- S3 object count

### 5. AI Services Dashboard

- Rekognition response time
- Bedrock invocations
- Authenticity score distribution (from logs)

## Inputs

| Name                              | Description                   | Type         | Default | Required |
| --------------------------------- | ----------------------------- | ------------ | ------- | -------- |
| dashboard_prefix                  | Prefix for dashboard names    | string       | -       | yes      |
| lambda_function_names             | List of Lambda function names | list(string) | []      | no       |
| step_functions_state_machine_name | State machine name            | string       | ""      | no       |
| dynamodb_table_name               | DynamoDB table name           | string       | ""      | no       |
| s3_bucket_name                    | S3 bucket name                | string       | ""      | no       |

## Outputs

| Name                             | Description                 |
| -------------------------------- | --------------------------- |
| dashboard_names                  | List of all dashboard names |
| api_performance_dashboard_arn    | API dashboard ARN           |
| lambda_performance_dashboard_arn | Lambda dashboard ARN        |
