# API-Assisted Set Determination

## Overview

Enhanced the OCR Reasoning Agent to verify card sets using the Pokémon TCG API, improving accuracy by matching collector numbers against authoritative data.

## Problem

Claude (Bedrock AI) was inferring card sets from OCR text, which could be inaccurate when:

- OCR text is ambiguous
- Multiple printings of the same card exist across different sets
- Collector numbers are misread

**Example**: Charizard VMAX exists in multiple sets (Silver Tempest, Shining Fates, Darkness Ablaze, etc.)

## Solution

### Two-Stage Set Determination

**Stage 1: AI Extraction**

- Claude extracts card name and collector number from OCR text
- Provides initial set guess based on patterns

**Stage 2: API Verification** ⭐ NEW

- Query Pokémon TCG API with card name
- Get all printings of that card
- Match collector number to find exact set
- Update set with verified data

## How It Works

### 1. Card Name Extraction (AI)

```
OCR Text → Claude → "Charizard VMAX"
```

### 2. API Query

```
GET /cards?q=name:"Charizard VMAX"
```

Returns all printings:

```json
[
  { "name": "Charizard VMAX", "set": "Darkness Ablaze", "number": "020/189" },
  { "name": "Charizard VMAX", "set": "Silver Tempest", "number": "018/195" },
  { "name": "Charizard VMAX", "set": "Shining Fates", "number": "SV107/SV122" }
]
```

### 3. Collector Number Matching

```
OCR: "018/195" → Matches "Silver Tempest"
```

### 4. Set Update

```json
{
  "set": {
    "value": "Silver Tempest",
    "confidence": 1.0,
    "rationale": "Exact collector number match. Verified via Pokémon TCG API."
  }
}
```

## Matching Strategies

### 1. Exact Match (Confidence: 1.0)

- Collector number matches exactly: "018/195" = "018/195"
- Highest confidence

### 2. Fuzzy Match (Confidence: 0.85)

- Card number matches, total differs: "18/195" ≈ "018/195"
- Handles OCR errors (missing leading zeros)

### 3. Most Recent Printing (Confidence: 0.5)

- No collector number match found
- Returns most recently released printing
- Fallback strategy

## Benefits

1. **Higher Accuracy**: Authoritative data from Pokémon TCG API
2. **Handles Multiple Printings**: Correctly identifies which set when card exists in multiple
3. **OCR Error Tolerance**: Fuzzy matching handles minor OCR mistakes
4. **Pricing Accuracy**: Correct set = correct pricing data
5. **Transparency**: Logs show AI guess vs. API-verified result

## Files Created

- `services/backend/src/adapters/pokemontcg-set-resolver.ts` - Set resolution logic
- `services/backend/src/agents/ocr-reasoning-agent.ts` - Updated to use resolver

## Example Logs

### Before (AI Only)

```json
{
  "set": {
    "value": "Silver Tempest",
    "confidence": 0.75,
    "rationale": "Inferred from copyright text and card template"
  }
}
```

### After (API-Verified)

```json
{
  "set": {
    "value": "Silver Tempest",
    "confidence": 1.0,
    "rationale": "Exact collector number match. Verified via Pokémon TCG API."
  }
}
```

## Fallback Behavior

If API verification fails:

- Network error
- API timeout
- Card not found in API

The system gracefully falls back to Claude's AI-inferred set with appropriate logging.

## Performance Impact

- **Additional latency**: ~200-500ms for API call
- **Acceptable**: Runs in parallel with other processing
- **Cacheable**: Could cache card name → printings mapping in future

## Deployment

No infrastructure changes needed - just rebuild and redeploy the Lambda:

```bash
cd services/backend
pnpm build
# Deploy via CI/CD or manual Lambda update
```

## Future Enhancements

1. **Cache API responses** - Reduce API calls for popular cards
2. **Batch API queries** - Query multiple cards at once
3. **Image matching** - Use card images from API for visual verification
4. **Rarity verification** - Cross-check rarity against API data
