# OCR Reasoning Monitoring

This document describes the CloudWatch metrics and alarms configured for the Bedrock OCR Reasoning Agent.

## Custom Metrics

All metrics are emitted to the `CollectIQ/{environment}` namespace with dimension `agent=ocr-reasoning`.

### BedrockOcrLatency

- **Unit**: Milliseconds
- **Description**: Time taken for Bedrock to process OCR reasoning requests
- **Target**: P95 < 5000ms

### BedrockOcrInputTokens

- **Unit**: Count
- **Description**: Number of input tokens sent to Bedrock per invocation
- **Typical Range**: 1000-2000 tokens

### BedrockOcrOutputTokens

- **Unit**: Count
- **Description**: Number of output tokens returned by Bedrock per invocation
- **Target**: Average < 3000 tokens

### BedrockOcrConfidence

- **Unit**: None (0.0-1.0)
- **Description**: Overall confidence score for extracted card metadata
- **Target**: Average > 0.6

### BedrockOcrFallbackUsed

- **Unit**: Count (0 or 1)
- **Description**: Whether fallback logic was used instead of Bedrock reasoning
- **Target**: < 10% of invocations

## CloudWatch Alarms

### High Fallback Rate

- **Alarm Name**: `{prefix}-ocr-high-fallback-rate`
- **Threshold**: > 10% of invocations use fallback
- **Evaluation Periods**: 2 consecutive periods (10 minutes)
- **Action**: SNS notification
- **Rationale**: High fallback rate indicates Bedrock API issues or configuration problems

### High Latency

- **Alarm Name**: `{prefix}-ocr-high-latency`
- **Threshold**: P95 latency > 5000ms
- **Evaluation Periods**: 2 consecutive periods (10 minutes)
- **Action**: SNS notification
- **Rationale**: Latency exceeding 5 seconds impacts user experience

### Low Confidence Scores

- **Alarm Name**: `{prefix}-ocr-low-confidence`
- **Threshold**: Average confidence < 0.6
- **Evaluation Periods**: 2 consecutive periods (10 minutes)
- **Action**: SNS notification
- **Rationale**: Low confidence indicates poor OCR quality or prompt issues

### High Token Usage

- **Alarm Name**: `{prefix}-ocr-high-token-usage`
- **Threshold**: Average output tokens > 3000
- **Evaluation Periods**: 2 consecutive periods (10 minutes)
- **Action**: SNS notification
- **Rationale**: High token usage increases costs and may indicate verbose responses

## Dashboard Widgets

The AI Services dashboard includes four OCR reasoning widgets:

1. **OCR Reasoning Latency**: Average, P95, and P99 latency over time
2. **OCR Reasoning Confidence Scores**: Average and minimum confidence scores
3. **OCR Reasoning Token Usage**: Input and output token counts
4. **OCR Reasoning Fallback Usage**: Count of fallback invocations

## SNS Topic

If `alarm_sns_topic_arn` is not provided, the module creates a dedicated SNS topic:

- **Topic Name**: `{prefix}-ocr-reasoning-alarms`
- **Purpose**: Receive alarm notifications for all OCR reasoning alarms

## Usage

To enable OCR reasoning monitoring, set the following variables:

```hcl
module "cloudwatch_dashboards" {
  source = "./modules/cloudwatch_dashboards"

  dashboard_prefix           = "collectiq-hackathon"
  ocr_reasoning_lambda_name  = "collectiq-ocr-reasoning-agent-hackathon"
  alarm_sns_topic_arn        = aws_sns_topic.alarms.arn  # Optional

  # ... other variables
}
```

## Troubleshooting

### High Fallback Rate

1. Check CloudWatch Logs for Bedrock API errors
2. Verify IAM permissions for `bedrock:InvokeModel`
3. Check Bedrock service quotas and throttling limits
4. Review recent Bedrock model updates or changes

### High Latency

1. Check Bedrock API latency in AWS Console
2. Review prompt length and complexity
3. Consider increasing Lambda memory allocation
4. Check for network issues or VPC configuration

### Low Confidence Scores

1. Review sample OCR inputs with low confidence
2. Analyze reasoning trails in CloudWatch Logs
3. Consider prompt engineering improvements
4. Check for poor quality card images

### High Token Usage

1. Review prompt templates for verbosity
2. Check if rationale fields are excessively long
3. Consider reducing max_tokens parameter
4. Analyze sample responses with high token counts
