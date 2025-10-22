# Quick Start: Backend Auto-Trigger

## TL;DR

Backend automatically triggers AI analysis when users upload cards. Users can still manually refresh pricing anytime.

---

## Deploy in 3 Steps

### 1. Build Backend

```bash
cd services/backend
pnpm build
```

### 2. Deploy Infrastructure

```bash
cd ../../infra/terraform/envs/hackathon
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

### 3. Test

```bash
# Upload a card at http://localhost:3000/upload

# Check logs
aws logs tail /aws/lambda/collectiq-hackathon-cards-create --follow

# Look for: "CardCreated event emitted successfully"
```

---

## How It Works

```
Upload → Create Card → EventBridge → Step Functions → Results
         (automatic, no user action needed)

Refresh → Manual Trigger → Step Functions → Updated Results
          (user clicks "Refresh" button)
```

---

## Verify Deployment

```bash
# Check environment variable
aws lambda get-function-configuration \
  --function-name collectiq-hackathon-cards-create \
  --query 'Environment.Variables.AUTO_TRIGGER_REVALUE'
# Should output: "true"

# Check EventBridge rule
aws events list-rules \
  --event-bus-name collectiq-hackathon-events \
  --query 'Rules[?Name==`card_created_auto_revalue`].State'
# Should output: ["ENABLED"]
```

---

## Disable (If Needed)

```bash
# Quick disable (keeps configuration)
aws events disable-rule \
  --name card_created_auto_revalue \
  --event-bus-name collectiq-hackathon-events

# Or set environment variable
aws lambda update-function-configuration \
  --function-name collectiq-hackathon-cards-create \
  --environment "Variables={AUTO_TRIGGER_REVALUE=false,...}"
```

---

## Documentation

- **Full deployment guide:** `docs/BACKEND_AUTO_TRIGGER_DEPLOYMENT.md`
- **Implementation summary:** `IMPLEMENTATION_SUMMARY.md`
- **API documentation:** `docs/API_FLOW.md`
- **Troubleshooting:** `docs/BACKEND_AUTO_TRIGGER_DEPLOYMENT.md#troubleshooting`

---

## Cost

**$0.000026 per upload** (~$0.26 per 10,000 uploads)

---

## Support

Questions? Check `docs/` folder or contact DevOps team.

---

**Ready to deploy! 🚀**
