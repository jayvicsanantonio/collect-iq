# Pokémon TCG API Setup (FREE)

## Quick Start

The Pokémon TCG API is **completely free** and requires **no approval**. You can start using it immediately!

### Option 1: Use Without API Key (Free Tier)

The API works without an API key, but with lower rate limits:

- **Rate Limit**: 1,000 requests/day
- **No registration required**
- **Works immediately**

Your Lambda functions will automatically work with the free tier.

### Option 2: Get API Key (Recommended - Still Free!)

With an API key, you get higher rate limits:

- **Rate Limit**: 20,000 requests/day
- **Still completely FREE**
- **Takes 2 minutes to set up**

## Step-by-Step Setup

### Step 1: Get Your Free API Key

1. Go to https://pokemontcg.io/
2. Click **"Get API Key"** button
3. Enter your email address
4. Check your email for the API key (arrives instantly)
5. Copy the API key

### Step 2: Store in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name POKEMON_TCG_API_KEY \
  --description "Pokemon TCG API Key (Free)" \
  --secret-string "YOUR_API_KEY_HERE"
```

### Step 3: Verify Secret

```bash
aws secretsmanager get-secret-value \
  --secret-id POKEMON_TCG_API_KEY \
  --query SecretString \
  --output text
```

### Step 4: Deploy (if not already done)

```bash
cd infra/terraform/envs/hackathon
terraform apply
```

That's it! Your pricing pipeline will now use real market data from TCGPlayer.

## What Data You Get

The Pokémon TCG API provides:

✅ **Card Information**

- Card name, set, number
- Rarity and type
- High-quality images

✅ **Market Pricing** (from TCGPlayer)

- Low, mid, high, and market prices
- Different variants (normal, holofoil, reverse holo, 1st edition)
- Updated regularly

✅ **European Pricing** (from CardMarket)

- Trend prices
- Average sell prices
- 1-day, 7-day, 30-day averages

✅ **Set Information**

- Release dates
- Set series
- Total cards in set

## API Limits

| Tier             | Rate Limit | Cost | Registration |
| ---------------- | ---------- | ---- | ------------ |
| **No API Key**   | 1,000/day  | FREE | None         |
| **With API Key** | 20,000/day | FREE | Email only   |

## Example API Response

```json
{
  "data": [
    {
      "id": "base1-58",
      "name": "Pikachu",
      "set": {
        "name": "Base Set",
        "series": "Base",
        "releaseDate": "1999/01/09"
      },
      "number": "58",
      "rarity": "Common",
      "tcgplayer": {
        "url": "https://prices.pokemontcg.io/tcgplayer/base1-58",
        "updatedAt": "2025/10/19",
        "prices": {
          "normal": {
            "low": 1.5,
            "mid": 3.0,
            "high": 5.0,
            "market": 2.75
          }
        }
      },
      "cardmarket": {
        "url": "https://prices.pokemontcg.io/cardmarket/base1-58",
        "prices": {
          "averageSellPrice": 2.5,
          "lowPrice": 1.0,
          "trendPrice": 2.8,
          "avg1": 2.6,
          "avg7": 2.7,
          "avg30": 2.75
        }
      }
    }
  ]
}
```

## Testing Your Setup

### Test 1: API Without Key

```bash
curl "https://api.pokemontcg.io/v2/cards?q=name:pikachu&pageSize=1"
```

### Test 2: API With Key

```bash
curl "https://api.pokemontcg.io/v2/cards?q=name:pikachu&pageSize=1" \
  -H "X-Api-Key: YOUR_API_KEY"
```

### Test 3: Check Lambda Logs

After uploading a card:

```bash
aws logs tail /aws/lambda/YOUR_PRICING_AGENT_FUNCTION --follow
```

Look for:

- ✅ "Pokémon TCG API key loaded" (if using API key)
- ✅ "Found X cards"
- ✅ "Pokémon TCG adapter fetched X comps"

## Advantages Over Other APIs

| Feature              | Pokémon TCG API | eBay API         | TCGPlayer API   | PriceCharting |
| -------------------- | --------------- | ---------------- | --------------- | ------------- |
| **Cost**             | FREE            | FREE             | FREE (approval) | $50/month     |
| **Setup Time**       | 2 minutes       | Weeks (approval) | Days (approval) | 5 minutes     |
| **Rate Limit**       | 20,000/day      | 5,000/day        | 300/min         | 1,000/day     |
| **Data Quality**     | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐       | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐    |
| **Approval**         | None            | Required         | Required        | None          |
| **Pokémon-Specific** | ✅ Yes          | ❌ No            | ✅ Yes          | ✅ Yes        |

## API Documentation

- **Official Docs**: https://docs.pokemontcg.io/
- **API Reference**: https://pokemontcg.io/
- **GitHub**: https://github.com/PokemonTCG/pokemon-tcg-sdk-typescript

## Troubleshooting

### "No pricing data available"

**Possible causes:**

1. Card name doesn't match database
2. Card is too new (not in database yet)
3. No TCGPlayer pricing available for that card

**Solutions:**

- Check CloudWatch logs for search query
- Try searching with just card name (no set)
- Verify card exists: https://pokemontcg.io/

### "Rate limit exceeded"

**Without API key:**

- You've exceeded 1,000 requests/day
- Get a free API key to increase to 20,000/day

**With API key:**

- You've exceeded 20,000 requests/day (unlikely)
- Implement caching (already done in pricing-orchestrator)
- Wait 24 hours for reset

### Lambda can't access secret

```bash
# Verify secret exists
aws secretsmanager get-secret-value --secret-id POKEMON_TCG_API_KEY

# Check Lambda IAM role has permission
aws iam get-role-policy --role-name YOUR_LAMBDA_ROLE --policy-name SecretsManagerAccess
```

## Next Steps

1. ✅ **You're done!** The API is already integrated
2. 🔄 **Test it**: Upload a card and check pricing
3. 📊 **Monitor**: Check CloudWatch logs for API calls
4. 🚀 **Scale**: Add eBay API when approved for even better data

## Future Enhancements

When you get eBay API access:

1. Uncomment eBay adapter in `pricing-orchestrator.ts`
2. Add eBay API key to Secrets Manager
3. Redeploy Lambda functions
4. You'll now have both Pokémon TCG API + eBay data!

```typescript
// In pricing-orchestrator.ts
this.sources = [
  new PokemonTCGAdapter(), // Already working
  new EbayAdapter(), // Add when approved
];
```
