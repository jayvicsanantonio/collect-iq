# EventBridge Input Transformer Fix

## Issue

Step Functions was failing with:

```
The JSONPath '$.s3Keys' specified for the field 's3Keys.$' could not be found in the input
```

## Root Cause

The EventBridge rule that auto-triggers Step Functions when a card is created was using the wrong input format:

**Wrong (old)**:

```json
{
  "userId": "...",
  "cardId": "...",
  "s3Key": "uploads/...", // ❌ Singular
  "s3Bucket": "...", // ❌ Separate field
  "cardMetadata": {
    // ❌ Wrong name
    "name": "",
    "set": ""
  }
}
```

**Correct (new)**:

```json
{
  "userId": "...",
  "cardId": "...",
  "s3Keys": {
    // ✅ Plural, nested
    "front": "uploads/..."
  },
  "cardMeta": {
    // ✅ Correct name
    "name": "",
    "set": ""
  },
  "requestId": "..." // ✅ Added
}
```

## Fix Applied

Updated `infra/terraform/envs/hackathon/main.tf`:

```hcl
input_template = <<-EOT
  {
    "userId": "<userId>",
    "cardId": "<cardId>",
    "s3Keys": {
      "front": "<frontS3Key>"
    },
    "cardMeta": {
      "name": "<name>",
      "set": "<set>",
      "number": "<number>",
      "rarity": "<rarity>",
      "conditionEstimate": "<conditionEstimate>"
    },
    "requestId": "<cardId>"
  }
EOT
```

## Deployment

```bash
cd infra/terraform/envs/hackathon
terraform apply
```

This will update the EventBridge rule's input transformer.

## Testing

1. **Create a new card** via the web app
2. **Check Step Functions** - should start automatically
3. **Verify execution** - should complete successfully

## Flow

```
User uploads card
  ↓
POST /cards (cards_create handler)
  ↓
Card saved to DynamoDB
  ↓
EventBridge event: CardCreated
  ↓
EventBridge rule transforms input
  ↓
Step Functions execution starts ✅
  ↓
RekognitionExtract → PricingAgent → AuthenticityAgent → Aggregator
```

## Related Fixes

This completes the full fix chain:

1. ✅ Step Functions definition (s3Keys structure)
2. ✅ Lambda handlers (OCR extraction, DynamoDB permissions)
3. ✅ EventBridge rule (input transformer) ← This fix

All three must be deployed for the full flow to work!
