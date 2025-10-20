# Deployment Checklist - Pricing Fix

## What Was Fixed

✅ Step Functions data flow (input/output mapping)
✅ Replaced unavailable APIs with Pokémon TCG API (free)
✅ Built and tested backend code

## Pre-Deployment Checklist

### 1. Backend Build

- [x] Code compiled successfully
- [x] No TypeScript errors
- [x] All dependencies resolved

### 2. Optional: Get Pokémon TCG API Key (2 minutes)

- [ ] Go to https://pokemontcg.io/
- [ ] Click "Get API Key"
- [ ] Enter your email
- [ ] Copy API key from email
- [ ] Store in AWS Secrets Manager:
  ```bash
  aws secretsmanager create-secret \
    --name POKEMON_TCG_API_KEY \
    --secret-string "YOUR_API_KEY_HERE"
  ```

**Note**: This step is optional. The API works without a key (1,000 requests/day).

## Deployment Steps

### Step 1: Deploy Infrastructure

```bash
cd infra/terraform/envs/hackathon
terraform plan
terraform apply
```

This will update:

- ✅ Step Functions state machine (fixed data flow)
- ✅ Lambda functions (new pricing adapter)
- ✅ IAM permissions (Secrets Manager access)

### Step 2: Verify Deployment

```bash
# Check Step Functions
aws stepfunctions list-state-machines

# Check Lambda functions
aws lambda list-functions | grep pricing-agent

# Check secrets (if you created the API key)
aws secretsmanager list-secrets | grep POKEMON_TCG
```

### Step 3: Test the Pipeline

1. **Upload a card** through the web app
2. **Check Step Functions execution**:
   ```bash
   aws stepfunctions list-executions \
     --state-machine-arn YOUR_STATE_MACHINE_ARN \
     --max-results 1
   ```
3. **Check Lambda logs**:
   ```bash
   aws logs tail /aws/lambda/YOUR_PRICING_AGENT_FUNCTION --follow
   ```

Look for:

- ✅ "Pokémon TCG API key loaded" (if using API key)
- ✅ "Found X cards"
- ✅ "Pokémon TCG adapter fetched X comps"
- ✅ "Pricing result computed"

## Expected Results

### Before Fix

❌ Step Functions failed with: "Cannot read properties of undefined (reading 'front')"
❌ Pricing agent failed with: "No pricing data available from any source"

### After Fix

✅ Step Functions completes successfully
✅ Pricing agent returns real market data
✅ Card valuation displayed in UI

## Troubleshooting

### Issue: Terraform not installed

```bash
brew install terraform
```

### Issue: Step Functions still failing

1. Check the error in AWS Console → Step Functions → Executions
2. Verify state machine definition was updated:
   ```bash
   aws stepfunctions describe-state-machine \
     --state-machine-arn YOUR_ARN \
     --query 'definition' \
     --output text | jq '.States.RekognitionExtract.Parameters.Payload'
   ```
3. Should show `s3Keys.$` not `s3Key.$`

### Issue: Pricing agent returns no data

1. **Check if card exists in database**:

   ```bash
   curl "https://api.pokemontcg.io/v2/cards?q=name:pikachu"
   ```

2. **Check Lambda logs**:

   ```bash
   aws logs tail /aws/lambda/YOUR_PRICING_AGENT_FUNCTION --follow
   ```

3. **Common causes**:
   - Card name doesn't match database (try simpler search)
   - Card is too new (not in database yet)
   - No TCGPlayer pricing for that specific card

### Issue: Lambda can't access secret

1. **Verify secret exists**:

   ```bash
   aws secretsmanager get-secret-value --secret-id POKEMON_TCG_API_KEY
   ```

2. **Check Lambda IAM role**:

   ```bash
   aws iam list-attached-role-policies --role-name YOUR_LAMBDA_ROLE
   ```

3. **Should include**: `SecretsManagerReadWrite` or custom policy with `secretsmanager:GetSecretValue`

## Rollback Plan

If something goes wrong:

```bash
cd infra/terraform/envs/hackathon
terraform plan -destroy -target=module.step_functions
# Review the plan
terraform destroy -target=module.step_functions
```

Then restore from backup or previous Terraform state.

## Post-Deployment

### Monitor for 24 Hours

1. **CloudWatch Alarms**: Check for Lambda errors
2. **Step Functions**: Monitor execution success rate
3. **API Usage**: Track Pokémon TCG API calls (should be < 1,000/day without key)

### Optimize if Needed

1. **Add API key** if hitting rate limits
2. **Adjust caching** in pricing-orchestrator.ts
3. **Add eBay adapter** when approved

## Success Criteria

- [ ] Step Functions executions complete successfully
- [ ] Pricing data returned for uploaded cards
- [ ] No Lambda errors in CloudWatch
- [ ] UI displays card valuation
- [ ] API costs remain under $1/month

## Documentation

Created documentation:

- ✅ `docs/PRICING_SOLUTION_SUMMARY.md` - Overview of solution
- ✅ `docs/POKEMON_TCG_API_SETUP.md` - Detailed setup guide
- ✅ `docs/PRICING_ALTERNATIVES.md` - Alternative solutions
- ✅ `docs/PRICING_API_SETUP.md` - Original API guide (reference)

## Next Steps After Deployment

1. **Test thoroughly** with various cards
2. **Monitor costs** in AWS Cost Explorer
3. **Get API key** if you haven't already (free, higher limits)
4. **Wait for eBay approval** to add second pricing source
5. **Collect feedback** on pricing accuracy

---

## Quick Deploy (TL;DR)

```bash
# 1. Build backend
cd services/backend && pnpm run build

# 2. Deploy infrastructure
cd ../../infra/terraform/envs/hackathon
terraform apply

# 3. Test
# Upload a card through the web app

# 4. Check logs
aws logs tail /aws/lambda/YOUR_PRICING_AGENT_FUNCTION --follow
```

Done! 🚀
