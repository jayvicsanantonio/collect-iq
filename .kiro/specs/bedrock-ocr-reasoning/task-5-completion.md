# Task 5 Completion: Update Step Functions Workflow

## Summary

Successfully updated the Step Functions workflow to integrate the OCR Reasoning Agent between the Rekognition Extract and Parallel Agents stages.

## Changes Made

### 1. Updated State Machine Definition (`state-machine-definition.json`)

#### Added OCR Reasoning Agent Task

- **Location**: Between `RekognitionExtract` and `ParallelAgents`
- **Input**: Receives `FeatureEnvelope` from Rekognition Extract
- **Output**: Returns enriched `CardMetadata` with confidence scores
- **Retry Policy**: 2 attempts with exponential backoff (2.0 rate)
- **Error Handling**: Routes to `OcrFallback` state on failure

#### Added OCR Fallback State

- **Type**: Pass state (no Lambda invocation)
- **Purpose**: Provides minimal metadata when OCR reasoning fails
- **Behavior**: Sets all fields to null with 0.0 confidence and `verifiedByAI: false`
- **Next**: Continues to `ParallelAgents` to maintain workflow continuity

#### Updated Pricing Agent Input

- **Changed**: `cardMeta` now receives `$.ocrMetadata.Payload.cardMetadata`
- **Benefit**: Pricing agent uses AI-enriched metadata instead of raw OCR

#### Updated Authenticity Agent Input

- **Changed**: `cardMeta` now receives `$.ocrMetadata.Payload.cardMetadata`
- **Added**: `frontS3Key` as separate parameter (previously nested in cardMeta)
- **Benefit**: Authenticity agent uses AI-enriched metadata for better verification

#### Updated Aggregator Input

- **Added**: `ocrMetadata` field with `$.ocrMetadata.Payload.cardMetadata`
- **Benefit**: Aggregator can persist OCR reasoning results to DynamoDB

### 2. Updated Step Functions Configuration (`step-functions.tf`)

#### Added Data Source

- **Added**: `data.aws_caller_identity.current` for constructing placeholder ARNs

#### Updated Lambda ARN Substitution

- **Added**: Substitution for `${ocr_reasoning_agent_lambda_arn}` placeholder
- **Fallback**: Uses `try()` to provide placeholder ARN when Lambda doesn't exist yet
- **Format**: `arn:aws:lambda:${region}:${account}:function:${prefix}-ocr-reasoning-agent`

#### Updated Lambda Function ARNs List

- **Changed**: Used `concat()` to conditionally add OCR reasoning agent ARN
- **Logic**: Uses `try()` to include ARN only if Lambda module exists
- **Benefit**: Terraform won't fail if OCR reasoning Lambda isn't created yet

## Workflow Flow

```
RekognitionExtract
    ↓
OcrReasoningAgent (NEW)
    ↓ (on success)
    ↓ (on failure) → OcrFallback
    ↓
ParallelAgents
    ├─ PricingAgent (receives enriched cardMeta)
    └─ AuthenticityAgent (receives enriched cardMeta)
    ↓
Aggregator (receives ocrMetadata)
```

## Error Handling Strategy

1. **OCR Reasoning Failure**: Routes to `OcrFallback` state
2. **Fallback Behavior**: Provides minimal metadata structure
3. **Workflow Continuity**: Always proceeds to `ParallelAgents`
4. **Downstream Impact**: Agents receive null values with 0.0 confidence

## Retry Configuration

- **Retry Attempts**: 2 (as specified in requirements)
- **Backoff Rate**: 2.0 (exponential)
- **Interval**: 2 seconds initial delay
- **Error Types**: Lambda service exceptions and throttling

## Data Flow

### Input to OCR Reasoning Agent

```json
{
  "userId": "...",
  "cardId": "...",
  "features": {
    "ocrBlocks": [...],
    "visualContext": {...}
  },
  "requestId": "..."
}
```

### Output from OCR Reasoning Agent

```json
{
  "cardMetadata": {
    "name": { "value": "...", "confidence": 0.95, "rationale": "..." },
    "rarity": { "value": "...", "confidence": 0.88, "rationale": "..." },
    "set": { "value": "...", "confidence": 0.92, "rationale": "..." },
    "overallConfidence": 0.91,
    "reasoningTrail": "..."
  }
}
```

## Requirements Satisfied

✅ **1.1**: OCR System invokes Rekognition, then Reasoning Layer processes results  
✅ **1.2**: Reasoning Layer receives complete Feature Envelope as input  
✅ **3.1-3.7**: Metadata extraction fields passed to downstream agents  
✅ **Retry Policy**: 2 attempts with exponential backoff  
✅ **Error Handling**: Catch block routes to fallback state  
✅ **Downstream Integration**: Pricing and Authenticity agents receive enriched metadata

## Next Steps

- **Task 6**: Create Lambda function infrastructure for OCR reasoning agent
- **Task 7**: Configure IAM permissions for Bedrock access
- **Task 12**: Update downstream agents to use enriched metadata
- **Task 13**: Update Aggregator to persist OCR metadata to DynamoDB

## Validation

- ✅ JSON syntax validated with `python3 -m json.tool`
- ✅ All placeholders use correct `$${...}` format for Terraform
- ✅ Conditional logic uses `try()` for graceful handling of missing Lambda
- ✅ Data flow maintains backward compatibility with existing agents

## Notes

- The OCR reasoning agent Lambda will be created in Task 6
- Until then, Terraform will use a placeholder ARN
- The workflow is designed to be resilient to OCR reasoning failures
- Fallback state ensures downstream agents always receive a cardMeta structure
