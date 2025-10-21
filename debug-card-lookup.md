# Debug Card Lookup Issue

## Problem

Frontend gets 404 when calling GET /cards/{id} even 10 minutes after upload.

## Possible Causes

### 1. Lambda Code Not Deployed

**Most Likely** - The fixes we made are only in local code, not deployed to AWS.

**Solution**: Deploy the Lambda functions:

```bash
cd infra/terraform/envs/hackathon
terraform apply -target=aws_lambda_function.cards_get -target=aws_lambda_function.aggregator -auto-approve
```

### 2. Card Not Created

The `cards_create` handler might be failing silently.

**Check**: Look at CloudWatch logs for `collectiq-hackathon-cards-create` Lambda

- Search for "Creating card" log entries
- Check if there are any errors

### 3. Wrong Card ID

Frontend might be requesting a different cardId than what was created.

**Check**:

- Frontend console logs - what cardId is being requested?
- Backend logs - what cardId was created?
- Do they match?

### 4. CardIdIndex GSI Not Working

The GSI might not be properly configured or the `cardId` attribute isn't being set.

**Check**: Query DynamoDB directly:

```bash
aws dynamodb scan \
  --table-name collectiq-hackathon-cards \
  --limit 5 \
  --output json
```

Look for:

- Does the item have a `cardId` attribute?
- Does it match the format (UUID)?

### 5. Table Name Mismatch

Lambda might be querying the wrong table.

**Check**: Lambda environment variables

```bash
aws lambda get-function-configuration \
  --function-name collectiq-hackathon-cards-get \
  --query 'Environment.Variables.DDB_TABLE'
```

Should return: `collectiq-hackathon-cards`

## Debugging Steps

1. **Check if card was created**:
   - Go to AWS Console → DynamoDB → Tables → collectiq-hackathon-cards
   - Click "Explore table items"
   - Look for recent items with `entityType = CARD`
   - Note the `cardId` value

2. **Check what cardId frontend is requesting**:
   - Open browser DevTools → Network tab
   - Look for the failed GET request to `/cards/{id}`
   - Note the `{id}` value in the URL

3. **Compare the two cardIds** - do they match?

4. **Check CloudWatch Logs**:
   - Go to AWS Console → CloudWatch → Log groups
   - Open `/aws/lambda/collectiq-hackathon-cards-get`
   - Look for recent log entries with the cardId
   - Check if it's finding the card or hitting the scan fallback

5. **Verify GSI**:
   - Go to DynamoDB table → Indexes tab
   - Confirm `CardIdIndex` exists
   - Check if it has any items

## Quick Fix

If you need an immediate workaround, you can query by PK+SK instead of using the GSI:

```typescript
// In getCard function, add this before fetchCardItemById:
const directResult = await client.send(
  new GetItemCommand({
    TableName: tableName,
    Key: {
      PK: generateUserPK(userId),
      SK: generateCardSK(cardId),
    },
  })
);

if (directResult.Item) {
  return itemToCard(directResult.Item as CardItem);
}
```

This bypasses the GSI entirely and queries directly by PK+SK.
