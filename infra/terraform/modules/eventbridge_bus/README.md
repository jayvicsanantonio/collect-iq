# EventBridge Bus Module

This module provisions Amazon EventBridge event bus for domain event coordination.

## Features

- Custom event bus
- Event rules with pattern matching
- Lambda and SQS targets
- Dead letter queue for failed deliveries
- Automatic retry with exponential backoff
- Input transformers for event payload manipulation

## Usage

```hcl
module "eventbridge" {
  source = "../../modules/eventbridge_bus"

  bus_name = "collectiq-hackathon-events"

  event_rules = {
    card_valuation_updated = {
      description = "Route card valuation updates"
      event_pattern = jsonencode({
        source      = ["collectiq.valuation"]
        detail-type = ["CardValuationUpdated"]
      })
      target_arn           = module.notification_lambda.function_arn
      target_type          = "lambda"
      target_function_name = module.notification_lambda.function_name
      input_transformer    = null
    }
    authenticity_flagged = {
      description = "Route authenticity flags"
      event_pattern = jsonencode({
        source      = ["collectiq.authenticity"]
        detail-type = ["AuthenticityFlagged"]
        detail = {
          authenticityScore = [{ numeric: ["<", 0.5] }]
        }
      })
      target_arn           = module.alert_queue.arn
      target_type          = "sqs"
      target_function_name = null
      input_transformer    = null
    }
  }

  dlq_message_retention_seconds = 1209600 # 14 days
  retry_maximum_event_age       = 86400   # 24 hours
  retry_maximum_retry_attempts  = 3

  tags = {
    Project     = "CollectIQ"
    Environment = "hackathon"
  }
}
```

## Event Pattern Examples

### Card Valuation Updated

```json
{
  "source": ["collectiq.valuation"],
  "detail-type": ["CardValuationUpdated"],
  "detail": {
    "userId": ["user-123"],
    "cardId": ["card-456"]
  }
}
```

### Authenticity Flagged

```json
{
  "source": ["collectiq.authenticity"],
  "detail-type": ["AuthenticityFlagged"],
  "detail": {
    "authenticityScore": [{ "numeric": ["<", 0.5] }]
  }
}
```

## Inputs

| Name                         | Description           | Type        | Default | Required |
| ---------------------------- | --------------------- | ----------- | ------- | -------- |
| bus_name                     | Name of the event bus | string      | -       | yes      |
| event_rules                  | Map of event rules    | map(object) | {}      | no       |
| retry_maximum_retry_attempts | Max retry attempts    | number      | 3       | no       |

## Outputs

| Name      | Description           |
| --------- | --------------------- |
| bus_name  | Event bus name        |
| bus_arn   | Event bus ARN         |
| dlq_url   | Dead letter queue URL |
| rule_arns | Map of rule ARNs      |
