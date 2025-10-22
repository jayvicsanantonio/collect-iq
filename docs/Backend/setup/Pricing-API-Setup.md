# Pricing API Setup Guide

This guide provides step-by-step instructions for obtaining API keys from each pricing source used by CollectIQ.

## Overview

CollectIQ integrates with three pricing sources:

1. **eBay Finding API** - Real-time sold listings data
2. **TCGPlayer API** - Trading card marketplace pricing
3. **PriceCharting API** - Historical pricing data

---

## 1. eBay Finding API

### What You Get

- Access to completed/sold listings data
- Real-time market pricing from actual sales
- Up to 5,000 API calls per day (free tier)

### Step-by-Step Setup

#### Step 1: Create an eBay Developer Account

1. Go to [eBay Developers Program](https://developer.ebay.com/)
2. Click **"Join Now"** or **"Sign In"**
3. Sign in with your eBay account (or create one if needed)
4. Accept the API License Agreement

#### Step 2: Create an Application

1. Navigate to [My Account > Application Keys](https://developer.ebay.com/my/keys)
2. Click **"Create an Application Key"**
3. Fill in the application details:
   - **Application Title**: `CollectIQ Pricing`
   - **Application Type**: Select **"Production"** (or **"Sandbox"** for testing)
   - **Primary Contact**: Your email
4. Click **"Continue"**

#### Step 3: Get Your App ID (API Key)

1. After creating the app, you'll see your credentials:
   - **App ID (Client ID)** - This is what you need
   - **Cert ID (Client Secret)** - Not needed for Finding API
2. Copy the **App ID**

#### Step 4: Enable Finding API

1. In your application settings, ensure **"Finding API"** is enabled
2. No additional permissions needed for public sold listings

#### Step 5: Store in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name EBAY_APP_ID \
  --description "eBay Finding API App ID" \
  --secret-string "YOUR_APP_ID_HERE"
```

### API Limits

- **Free Tier**: 5,000 calls/day
- **Rate Limit**: ~5 requests/second
- **Cost**: Free for Finding API

### Testing Your Key

```bash
curl "https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=YOUR_APP_ID&RESPONSE-DATA-FORMAT=JSON&keywords=pikachu&categoryId=183454&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true"
```

---

## 2. TCGPlayer API

### What You Get

- Official TCG marketplace pricing
- Product catalog with accurate card data
- Market price, low price, mid price data

### Step-by-Step Setup

#### Step 1: Create a TCGPlayer Account

1. Go to [TCGPlayer](https://www.tcgplayer.com/)
2. Click **"Sign Up"** and create an account
3. Verify your email address

#### Step 2: Apply for API Access

1. Navigate to [TCGPlayer API Documentation](https://docs.tcgplayer.com/docs)
2. Click **"Get API Access"** or go to [TCGPlayer Developer Portal](https://developer.tcgplayer.com/)
3. Fill out the API Access Request Form:
   - **Company/Project Name**: CollectIQ
   - **Use Case**: Card valuation and pricing aggregation
   - **Expected Volume**: Estimate your daily API calls
   - **Website/App URL**: Your application URL (or GitHub repo)
4. Submit the form and wait for approval (usually 1-3 business days)

#### Step 3: Get Your API Credentials

1. Once approved, log in to [TCGPlayer Developer Portal](https://developer.tcgplayer.com/)
2. Navigate to **"Applications"** or **"API Keys"**
3. Create a new application:
   - **Application Name**: `CollectIQ`
   - **Description**: Card pricing and valuation
4. Copy your credentials:
   - **Public Key** (Client ID)
   - **Private Key** (Client Secret)

#### Step 4: Store in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name TCGPLAYER_CREDENTIALS \
  --description "TCGPlayer API Credentials" \
  --secret-string '{"publicKey":"YOUR_PUBLIC_KEY","privateKey":"YOUR_PRIVATE_KEY"}'
```

### API Limits

- **Free Tier**: Varies by approval (typically 10,000-50,000 calls/month)
- **Rate Limit**: 300 requests/minute
- **Cost**: Free for approved developers

### Testing Your Key

```bash
# Get access token
curl -X POST "https://api.tcgplayer.com/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=YOUR_PUBLIC_KEY&client_secret=YOUR_PRIVATE_KEY"

# Use token to search products
curl "https://api.tcgplayer.com/catalog/products?categoryId=3&productName=pikachu" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 3. PriceCharting API

### What You Get

- Historical pricing data
- Price trends over time
- Graded card pricing

### Step-by-Step Setup

#### Step 1: Create a PriceCharting Account

1. Go to [PriceCharting](https://www.pricecharting.com/)
2. Click **"Sign Up"** in the top right
3. Create an account and verify your email

#### Step 2: Subscribe to API Access

1. Navigate to [PriceCharting API](https://www.pricecharting.com/api-documentation)
2. Click **"Get API Access"** or **"Subscribe"**
3. Choose a plan:
   - **Hobbyist**: $9.99/month - 1,000 calls/day
   - **Professional**: $29.99/month - 10,000 calls/day
   - **Enterprise**: Custom pricing - Unlimited calls
4. Complete the payment process

#### Step 3: Get Your API Key

1. After subscribing, go to [Account Settings > API](https://www.pricecharting.com/console)
2. Your API key will be displayed on the page
3. Copy the API key

#### Step 4: Store in AWS Secrets Manager

```bash
aws secretsmanager create-secret \
  --name PRICECHARTING_KEY \
  --description "PriceCharting API Key" \
  --secret-string "YOUR_API_KEY_HERE"
```

### API Limits

- **Hobbyist**: 1,000 calls/day ($9.99/month)
- **Professional**: 10,000 calls/day ($29.99/month)
- **Rate Limit**: 10 requests/second
- **Cost**: Paid subscription required

### Testing Your Key

```bash
curl "https://www.pricecharting.com/api/products?t=YOUR_API_KEY&q=pikachu&type=pokemon-card"
```

---

## AWS Secrets Manager Setup

### Grant Lambda Access to Secrets

After creating the secrets, ensure your Lambda functions have permission to read them:

#### Option 1: Update Lambda IAM Role (Recommended)

Add this policy to your Lambda execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": [
        "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:EBAY_APP_ID*",
        "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:TCGPLAYER_CREDENTIALS*",
        "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:PRICECHARTING_KEY*"
      ]
    }
  ]
}
```

#### Option 2: Use Terraform (Automated)

The Terraform configuration should already include this. Verify in `infra/terraform/modules/lambda_fn/main.tf`:

```hcl
resource "aws_iam_role_policy_attachment" "secrets_manager" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/SecretsManagerReadWrite"
}
```

---

## Verification

### Check Secrets Are Created

```bash
aws secretsmanager list-secrets --query 'SecretList[?contains(Name, `EBAY`) || contains(Name, `TCGPLAYER`) || contains(Name, `PRICECHARTING`)].Name'
```

### Test Secret Retrieval

```bash
# Test eBay
aws secretsmanager get-secret-value --secret-id EBAY_APP_ID --query SecretString --output text

# Test TCGPlayer
aws secretsmanager get-secret-value --secret-id TCGPLAYER_CREDENTIALS --query SecretString --output text

# Test PriceCharting
aws secretsmanager get-secret-value --secret-id PRICECHARTING_KEY --query SecretString --output text
```

---

## Cost Summary

| Service               | Free Tier         | Paid Tier              | Recommended          |
| --------------------- | ----------------- | ---------------------- | -------------------- |
| **eBay Finding API**  | 5,000 calls/day   | N/A                    | ✅ Start here (Free) |
| **TCGPlayer API**     | Approval required | Free for approved devs | ✅ Apply early       |
| **PriceCharting API** | None              | $9.99-$29.99/month     | ⚠️ Optional (paid)   |

### Recommended Approach

1. **Start with eBay** - Free and provides real sold listings
2. **Apply for TCGPlayer** - Free but requires approval (1-3 days)
3. **Add PriceCharting later** - Only if you need historical data

---

## Troubleshooting

### eBay API Returns 403 Forbidden

- Verify your App ID is correct
- Ensure you're using the Production key (not Sandbox) for production data
- Check that Finding API is enabled in your app settings

### TCGPlayer API Returns 401 Unauthorized

- Verify both Public Key and Private Key are correct
- Ensure your API access has been approved
- Check that you're requesting a token before making API calls

### PriceCharting API Returns 403 Forbidden

- Verify your API key is correct
- Check that your subscription is active
- Ensure you haven't exceeded your daily call limit

### Lambda Can't Access Secrets

- Verify secrets exist: `aws secretsmanager list-secrets`
- Check Lambda IAM role has `secretsmanager:GetSecretValue` permission
- Ensure secret names match exactly (case-sensitive)
- Verify Lambda is in the same AWS region as secrets

---

## Next Steps

After setting up your API keys:

1. **Deploy the updated Lambda functions**:

   ```bash
   cd infra/terraform/envs/hackathon
   terraform apply
   ```

2. **Test the pricing pipeline**:
   - Upload a card image through the web app
   - Check CloudWatch Logs for pricing agent execution
   - Verify pricing data is returned from your configured sources

3. **Monitor API usage**:
   - Set up CloudWatch alarms for API errors
   - Track daily API call counts
   - Monitor costs (especially for PriceCharting)

---

## Support Resources

- **eBay Developer Support**: https://developer.ebay.com/support
- **TCGPlayer API Docs**: https://docs.tcgplayer.com/
- **PriceCharting Support**: support@pricecharting.com
