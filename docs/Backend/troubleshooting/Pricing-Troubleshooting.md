# Pricing Pipeline Troubleshooting

## Common Issue: "No pricing data available from any source"

This error occurs when the Pokémon TCG API can't find matching cards. Here's how to diagnose and fix it.

## Root Causes

### 1. Card Name from OCR Doesn't Match Database

**Problem**: The Rekognition OCR might extract the card name with:

- Extra characters or symbols
- Misspellings
- Different formatting than the database

**Example**:

- OCR extracts: `"Pikachu V-MAX"`
- Database has: `"Pikachu VMAX"` (no hyphen)

**Solution**: The adapter now uses wildcard search (`name:*Pikachu*`) to handle variations.

### 2. Card Not in Database

**Problem**: Very new cards or obscure promotional cards might not be in the Pokémon TCG API yet.

**Solution**:

- Check if card exists: https://pokemontcg.io/
- Wait for database to update (usually within days of release)
- Consider adding a fallback pricing mechanism

### 3. API Rate Limit Exceeded

**Problem**: Without an API key, you're limited to 1,000 requests/day.

**Solution**: Get a free API key (see `POKEMON_TCG_API_SETUP.md`)

## Debugging Steps

### Step 1: Check Lambda Logs

```bash
aws logs tail /aws/lambda/YOUR_PRICING_AGENT_FUNCTION --follow
```

Look for these log messages:

**Good signs:**

```
✅ "Searching Pokémon TCG API" - API call was made
✅ "Found X cards from Pokémon TCG API" - Cards were found
✅ "Pokémon TCG adapter fetched X comps" - Pricing data extracted
```

**Warning signs:**

```
⚠️ "No exact matches found, trying simplified search" - Exact match failed, trying fuzzy
⚠️ "No Pokémon TCG cards found" - No matches at all
⚠️ "No pricing data available from any source" - Final error
```

### Step 2: Check What Card Name Was Extracted

Look for the log entry from Rekognition:

```json
{
  "message": "Front image features extracted successfully",
  "ocrBlockCount": 45,
  "cardName": "EXTRACTED_NAME_HERE"
}
```

### Step 3: Test the Card Name Manually

```bash
# Test exact search
curl "https://api.pokemontcg.io/v2/cards?q=name:CARD_NAME_HERE"

# Test wildcard search (what the adapter uses)
curl "https://api.pokemontcg.io/v2/cards?q=name:*CARD_NAME_HERE*"

# Test very simple search
curl "https://api.pokemontcg.io/v2/cards?q=name:pikachu"
```

### Step 4: Check API Response

If the API returns data but pricing still fails, check if the cards have `tcgplayer` pricing:

```bash
curl "https://api.pokemontcg.io/v2/cards?q=name:pikachu" | jq '.data[0].tcgplayer.prices'
```

Should return something like:

```json
{
  "normal": {
    "low": 1.5,
    "mid": 3.0,
    "high": 5.0,
    "market": 2.75
  }
}
```

## Solutions

### Solution 1: Improve OCR Accuracy

The card name extraction happens in Rekognition. To improve it:

1. **Better image quality**: Ensure uploaded images are clear and well-lit
2. **Crop to card**: Remove background noise
3. **Straight angle**: Card should be flat and straight

### Solution 2: Add Fallback Pricing

If the API consistently fails for certain cards, add a fallback:

```typescript
// In pricing-orchestrator.ts
if (rawComps.length === 0) {
  logger.warn('No pricing data from API, using estimated pricing');

  // Return estimated pricing based on rarity
  return {
    valueLow: 1.0,
    valueMedian: 5.0,
    valueHigh: 10.0,
    compsCount: 0,
    sources: ['Estimated'],
    confidence: 0.3, // Low confidence
  };
}
```

### Solution 3: Manual Card Name Override

For testing, you can temporarily hardcode a card name:

```typescript
// In pricing-agent.ts (temporary for testing)
const pricingResult = await orchestrator.fetchAllComps({
  cardName: 'Pikachu', // Hardcode for testing
  set: undefined,
  number: undefined,
  condition,
  windowDays: 14,
});
```

### Solution 4: Add More Pricing Sources

When eBay API is approved, add it as a second source:

```typescript
// In pricing-orchestrator.ts
this.sources = [
  new PokemonTCGAdapter(),
  new EbayAdapter(), // Add when approved
];
```

This provides redundancy if one source fails.

## Monitoring

### Set Up CloudWatch Alarms

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name pricing-agent-errors \
  --alarm-description "Alert when pricing agent fails" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=YOUR_PRICING_AGENT_FUNCTION
```

### Track Success Rate

Add custom metrics in the pricing agent:

```typescript
// After successful pricing
await metrics.recordPricingSuccess(cardId);

// After failure
await metrics.recordPricingFailure(cardId, 'no_data');
```

## Testing Specific Cards

### Test with Known Cards

```bash
# These should always work:
curl "https://api.pokemontcg.io/v2/cards?q=name:*Pikachu*&pageSize=1"
curl "https://api.pokemontcg.io/v2/cards?q=name:*Charizard*&pageSize=1"
curl "https://api.pokemontcg.io/v2/cards?q=name:*Mewtwo*&pageSize=1"
```

### Test with Your Card

1. Upload the card image
2. Check CloudWatch logs for extracted name
3. Test that name in the API
4. Compare results

## Recent Improvements

### v1.1 - Better Search Logic

✅ **Wildcard search**: Uses `name:*CardName*` instead of exact match
✅ **Fallback search**: If exact search fails, tries simplified search
✅ **Better logging**: Shows what was searched and what was found
✅ **Character cleaning**: Removes special characters that confuse the API

### Example Log Output (Success)

```
INFO: Searching Pokémon TCG API
  searchQuery: "name:*Pikachu* set.name:*Base Set*"
  cardName: "Pikachu"
  set: "Base Set"

INFO: Found 5 cards from Pokémon TCG API
  totalCount: 5
  cardNames: ["Pikachu", "Pikachu (Yellow Cheeks)", "Pikachu (Red Cheeks)"]

INFO: Pokémon TCG adapter fetched 15 comps from 5 cards
```

### Example Log Output (Failure with Fallback)

```
INFO: Searching Pokémon TCG API
  searchQuery: "name:*Pikach* set.name:*Bse Set*"

INFO: Found 0 cards from Pokémon TCG API

WARN: No exact matches found, trying simplified search
  originalQuery: "name:*Pikach* set.name:*Bse Set*"
  simplifiedQuery: "Pikach"

INFO: Simplified search found 10 cards
  cardNames: ["Pikachu", "Pikachu V", "Pikachu VMAX"]
```

## Next Steps

1. **Deploy the updated code** with improved search logic
2. **Test with a known card** (e.g., Pikachu)
3. **Check CloudWatch logs** to see what's being searched
4. **Adjust search logic** if needed based on your specific cards
5. **Add eBay API** when approved for redundancy

## Support

If you're still having issues:

1. Share the CloudWatch logs (search query and results)
2. Share the card image (to verify OCR quality)
3. Test the card name manually in the API
4. Check if the card exists in the database: https://pokemontcg.io/

## Quick Fix Checklist

- [ ] Deployed latest code with improved search
- [ ] Verified API key is set (optional but recommended)
- [ ] Tested with a known card (Pikachu, Charizard)
- [ ] Checked CloudWatch logs for search queries
- [ ] Verified card exists in Pokémon TCG API
- [ ] Confirmed card has TCGPlayer pricing data
- [ ] Image quality is good (clear, straight, well-lit)
