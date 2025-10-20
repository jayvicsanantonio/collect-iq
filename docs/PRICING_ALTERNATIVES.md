# Alternative Pricing Solutions for CollectIQ

## The Problem

- **TCGPlayer**: No longer provides API access to new developers
- **eBay**: Requires approval (can take weeks)
- **PriceCharting**: $50/month is too expensive for early stage

## Recommended Solutions

### Option 1: Web Scraping (Legal & Ethical)

Use public data from websites that allow scraping in their terms of service.

#### A. TCGPlayer Public Pages (No API needed)

- **What**: Scrape public product pages
- **Cost**: Free
- **Legal**: Check robots.txt and terms of service
- **Implementation**: Use Puppeteer/Playwright in Lambda

```typescript
// Example: Scrape TCGPlayer product page
async function scrapeTCGPlayerPrice(cardName: string, set: string) {
  const searchUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(cardName)}`;
  // Use Puppeteer to load page and extract pricing
}
```

#### B. eBay Public Sold Listings (No API needed)

- **What**: Scrape eBay's public sold listings page
- **Cost**: Free
- **Legal**: eBay's robots.txt allows some scraping
- **URL**: `https://www.ebay.com/sch/i.html?_nkw=CARD_NAME&LH_Sold=1&LH_Complete=1`

```typescript
// Example: Scrape eBay sold listings
async function scrapeEbaySoldListings(cardName: string) {
  const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cardName)}&LH_Sold=1&LH_Complete=1`;
  // Parse HTML to extract prices and dates
}
```

**Pros**: Free, immediate access
**Cons**: More fragile (breaks if HTML changes), slower, may violate ToS

---

### Option 2: Free/Affordable APIs

#### A. Pokémon TCG API (Free)

- **Website**: https://pokemontcg.io/
- **Cost**: FREE
- **What**: Official Pokémon card database with market prices
- **Rate Limit**: 1,000 requests/day (free), 20,000/day ($10/month)
- **Data**: Card details, set info, market prices from TCGPlayer

```bash
# Get API key (free)
curl -X POST https://api.pokemontcg.io/v2/users \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com"}'

# Search for cards
curl "https://api.pokemontcg.io/v2/cards?q=name:pikachu" \
  -H "X-Api-Key: YOUR_API_KEY"
```

**This is your best option!** ✅

#### B. Scryfall (Free - for Magic: The Gathering)

- Not applicable for Pokémon, but good reference for future expansion

#### C. CardMarket API (Free for EU)

- **Website**: https://www.cardmarket.com/en/Pokemon/API
- **Cost**: Free with approval
- **Region**: Primarily European market
- **Application**: Requires business registration

---

### Option 3: Build Your Own Pricing Database

#### A. Crowdsourced Pricing

- Let users submit prices they've seen
- Build a community-driven pricing database
- Validate submissions with multiple data points

#### B. Historical Data Collection

- Start collecting pricing data now (even with mock data)
- Build your own historical database over time
- Use web scraping to seed initial data

#### C. Hybrid Approach

- Use Pokémon TCG API as primary source
- Supplement with web scraping for recent sales
- Build your own historical trends

---

### Option 4: Use Mock Data for MVP/Demo

For hackathon or initial demo purposes:

#### A. Realistic Mock Data

- Generate prices based on card rarity and condition
- Add realistic variance (±20-30%)
- Include confidence scores

#### B. Static Pricing Database

- Create a JSON file with common card prices
- Update manually or via periodic scraping
- Good enough for proof of concept

```json
{
  "pikachu-base-set-1st-edition": {
    "nm": { "low": 100, "median": 150, "high": 250 },
    "lp": { "low": 70, "median": 100, "high": 150 }
  }
}
```

---

## Recommended Implementation Plan

### Phase 1: MVP (Now)

1. **Use Pokémon TCG API** as primary source (FREE)
2. **Keep mock adapter** as fallback
3. **Add disclaimer**: "Pricing estimates based on market data"

### Phase 2: Enhanced (After eBay approval)

1. **Add eBay API** when approved
2. **Supplement with web scraping** for real-time data
3. **Build historical database** from collected data

### Phase 3: Production (Future)

1. **Evaluate paid APIs** if revenue justifies cost
2. **Build proprietary pricing model** from collected data
3. **Add user-submitted pricing** for community validation

---

## Implementation: Pokémon TCG API

### Step 1: Get API Key (Free)

1. Go to https://pokemontcg.io/
2. Click "Get API Key"
3. Enter your email
4. Receive API key instantly

### Step 2: Store in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name POKEMON_TCG_API_KEY \
  --description "Pokemon TCG API Key" \
  --secret-string "YOUR_API_KEY_HERE"
```

### Step 3: Create Adapter

I'll create a new adapter for you that uses this API.

### API Features

- ✅ Free tier: 1,000 requests/day
- ✅ Card database with images
- ✅ Market prices from TCGPlayer
- ✅ Set information
- ✅ Rarity and condition data
- ✅ No approval needed

### Example Response

```json
{
  "data": [
    {
      "id": "base1-58",
      "name": "Pikachu",
      "set": { "name": "Base Set" },
      "rarity": "Common",
      "tcgplayer": {
        "prices": {
          "normal": {
            "low": 1.5,
            "mid": 3.0,
            "high": 5.0,
            "market": 2.75
          }
        }
      }
    }
  ]
}
```

---

## Legal Considerations

### Web Scraping

- ✅ Check `robots.txt` before scraping
- ✅ Respect rate limits (1 request/second max)
- ✅ Use proper User-Agent headers
- ✅ Cache results to minimize requests
- ❌ Don't scrape if ToS explicitly forbids it
- ❌ Don't overwhelm servers with requests

### Fair Use

- ✅ Transformative use (aggregation, analysis)
- ✅ Proper attribution
- ✅ Non-commercial or educational use
- ❌ Don't republish raw data
- ❌ Don't compete directly with source

---

## Cost Comparison

| Solution            | Cost      | Setup Time        | Data Quality | Reliability |
| ------------------- | --------- | ----------------- | ------------ | ----------- |
| **Pokémon TCG API** | FREE      | 5 min             | ⭐⭐⭐⭐     | ⭐⭐⭐⭐⭐  |
| **Mock Data**       | FREE      | 0 min             | ⭐⭐         | ⭐⭐⭐⭐⭐  |
| **Web Scraping**    | FREE      | 2-4 hours         | ⭐⭐⭐       | ⭐⭐⭐      |
| **eBay API**        | FREE      | Wait for approval | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐    |
| **PriceCharting**   | $50/month | 5 min             | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐  |

---

## My Recommendation

### For Hackathon/Demo (This Weekend)

1. **Use Pokémon TCG API** - Free, instant, good data
2. **Keep mock adapter** as fallback
3. **Add disclaimer** about pricing being estimates

### For Production (Next Month)

1. **Wait for eBay approval** - Best free option for sold listings
2. **Add web scraping** for supplemental data
3. **Build your own database** from collected data

### For Scale (6+ Months)

1. **Evaluate paid APIs** when you have revenue
2. **Build ML pricing model** from historical data
3. **Add user feedback** to improve accuracy

---

## Next Steps

Would you like me to:

1. ✅ **Implement Pokémon TCG API adapter** (recommended)
2. ⚠️ **Create web scraping adapters** (more complex, legal gray area)
3. ✅ **Improve mock adapter** with better algorithms
4. ✅ **Create hybrid solution** (Pokémon TCG API + mock fallback)

Let me know which direction you'd like to go!
