# OCR Card Name Extraction

## Problem

The initial OCR extraction was picking up ability text instead of card names:

**Example**:

- ❌ Extracted: "Flip a coin If heads search your deck for up to 3 basic"
- ✅ Should be: "Pikachu" or "Charizard"

## Root Cause

The original logic simply picked the largest text block, which on Pokémon cards is often the ability description, not the card name.

## Solution

Implemented intelligent filtering to identify card names based on typical Pokémon card layout:

### Card Name Characteristics

1. **Position**: Card names are at the TOP of the card (< 40% from top edge)
2. **Length**: Card names are SHORT (1-4 words, < 30 characters)
3. **Content**: Card names DON'T contain ability keywords
4. **Font**: Card names are typically LARGER than body text

### Filtering Logic

```typescript
// Step 1: Filter candidates
const candidateBlocks = event.features.ocr.filter((block) => {
  const text = block.text || '';
  const wordCount = text.split(/\s+/).length;
  const charCount = text.length;
  const topPosition = block.boundingBox?.top || 1;

  // Must be:
  const isReasonableLength = wordCount >= 1 && wordCount <= 4 && charCount <= 30;
  const isNearTop = topPosition < 0.4; // Top 40% of card
  const notAbilityText = !text
    .toLowerCase()
    .match(
      /\b(flip|coin|heads|tails|damage|attack|energy|deck|discard|draw|search|your|opponent)\b/
    );

  return isReasonableLength && isNearTop && notAbilityText;
});

// Step 2: Sort candidates
candidateBlocks.sort((a, b) => {
  // Prioritize:
  // 1. Higher position (lower Y value = closer to top)
  // 2. Larger text size
  // 3. Higher OCR confidence

  const topA = a.boundingBox?.top || 1;
  const topB = b.boundingBox?.top || 1;

  if (Math.abs(topA - topB) > 0.05) {
    return topA - topB; // Closer to top wins
  }

  const sizeA = (a.boundingBox?.height || 0) * (a.boundingBox?.width || 0);
  const sizeB = (b.boundingBox?.height || 0) * (b.boundingBox?.width || 0);
  const confidenceA = a.confidence || 0;
  const confidenceB = b.confidence || 0;

  return sizeB * confidenceB - sizeA * confidenceA;
});

// Step 3: Take best candidate
cardName = candidateBlocks[0]?.text || 'Unknown Card';
```

### Excluded Keywords

These words indicate ability text, not card names:

- flip, coin, heads, tails
- damage, attack, energy
- deck, discard, draw, search
- your, opponent

## Examples

### Example 1: Pikachu Card

**OCR Blocks**:

```
1. "Pikachu" (top: 0.05, size: large, confidence: 0.98)
2. "HP 60" (top: 0.08, size: medium, confidence: 0.95)
3. "Flip a coin..." (top: 0.45, size: large, confidence: 0.92)
```

**Result**: ✅ "Pikachu" (top position, reasonable length, no keywords)

### Example 2: Charizard VMAX

**OCR Blocks**:

```
1. "Charizard VMAX" (top: 0.06, size: large, confidence: 0.97)
2. "HP 330" (top: 0.10, size: medium, confidence: 0.96)
3. "G-Max Wildfire" (top: 0.50, size: large, confidence: 0.94)
```

**Result**: ✅ "Charizard VMAX" (top position, 2 words, no keywords)

### Example 3: Card with Long Ability (Previous Failure)

**OCR Blocks**:

```
1. "Mewtwo" (top: 0.07, size: medium, confidence: 0.96)
2. "Flip a coin If heads search your deck for up to 3 basic" (top: 0.50, size: large, confidence: 0.92)
```

**Before**: ❌ Picked #2 (largest text)
**After**: ✅ Picked #1 (top position, short, no keywords)

## Fallback Behavior

If no candidates pass the filters (rare edge case):

```typescript
// Take the topmost text block regardless of content
const topBlock = [...event.features.ocr].sort((a, b) => {
  return (a.boundingBox?.top || 1) - (b.boundingBox?.top || 1);
})[0];

cardName = topBlock?.text || 'Unknown Card';
```

This ensures we always extract SOMETHING, even if it's not perfect.

## Logging

The extraction now logs detailed information:

```json
{
  "message": "Extracted card name from OCR",
  "cardName": "Pikachu",
  "ocrBlockCount": 45,
  "candidateCount": 3,
  "confidence": 0.98,
  "position": 0.05
}
```

Or if fallback is used:

```json
{
  "level": "WARN",
  "message": "No good card name candidates, using topmost text",
  "cardName": "Some Text",
  "ocrBlockCount": 45
}
```

## Testing

### Test with Known Cards

Upload images of these cards and verify extraction:

1. **Pikachu** (Base Set) → Should extract "Pikachu"
2. **Charizard VMAX** → Should extract "Charizard VMAX"
3. **Mewtwo EX** → Should extract "Mewtwo EX"
4. **Rayquaza V** → Should extract "Rayquaza V"

### Check CloudWatch Logs

```bash
aws logs tail /aws/lambda/collectiq-hackathon-pricing-agent --follow
```

Look for:

- ✅ "Extracted card name from OCR"
- ✅ cardName should be actual card name (not ability text)
- ✅ candidateCount > 0
- ✅ position < 0.4

## Limitations

### May Still Fail For:

1. **Rotated cards** - Position detection assumes upright orientation
2. **Damaged cards** - OCR might miss the name entirely
3. **Foreign language cards** - Keywords are English-only
4. **Promo cards** - Unusual layouts might confuse the logic

### Solutions:

1. **Image preprocessing** - Rotate and crop before OCR
2. **Multiple attempts** - Try different orientations
3. **User confirmation** - Let users verify/correct the name
4. **Manual override** - Allow users to type the card name

## Future Improvements

### v2.0 - Machine Learning

Train a model to identify card name regions:

- Use labeled dataset of Pokémon cards
- Detect name bounding box directly
- Higher accuracy than heuristics

### v2.1 - Template Matching

Use known card templates:

- Match card layout to known sets
- Extract name from expected position
- Works even with poor OCR

### v2.2 - User Feedback Loop

Learn from corrections:

- Track when users correct card names
- Adjust heuristics based on patterns
- Improve over time

## Deployment

This improvement is included in the latest build:

```bash
cd services/backend
pnpm run build

cd ../../infra/terraform/envs/hackathon
terraform apply
```

## Verification

After deployment, test with a card that has long ability text:

1. Upload the card
2. Check CloudWatch logs
3. Verify card name is extracted (not ability text)
4. Confirm pricing search uses correct name

Expected log flow:

```
✅ "Extracted card name from OCR" → cardName: "Pikachu"
✅ "Searching Pokémon TCG API" → searchQuery: "name:*Pikachu*"
✅ "Found 10 cards from Pokémon TCG API"
✅ "Pricing data fetched successfully"
```

## Summary

The improved OCR extraction:

- ✅ Filters out ability text
- ✅ Prioritizes top-positioned text
- ✅ Validates reasonable card name length
- ✅ Falls back gracefully if needed
- ✅ Logs detailed extraction info

This should significantly improve card name accuracy! 🎯
