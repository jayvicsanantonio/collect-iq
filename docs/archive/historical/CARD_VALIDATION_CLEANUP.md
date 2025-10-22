# Card Validation and Automatic Cleanup

## Overview

The Rekognition Extract component now validates that uploaded images are actually trading cards and automatically cleans up invalid uploads.

## Features

### 1. Content Safety Validation (Kid-Friendly)

**Location:** `services/backend/src/adapters/rekognition-adapter.ts`

The `validateContentSafety()` method uses AWS Rekognition's content moderation to block inappropriate content:

**Blocked Content Categories** (confidence > 60%):

- Explicit Nudity
- Suggestive content
- Violence
- Visually Disturbing
- Rude Gestures
- Drugs, Tobacco, Alcohol
- Gambling
- Hate Symbols
- Exposed body parts
- Partial Nudity

**API Used:** `DetectModerationLabels`

- Cost: $1 per 1,000 images
- Latency: ~300-500ms
- MinConfidence: 60% (lower threshold for safety)

**Error Message:**

```
Image contains inappropriate content and cannot be uploaded. This app is kid-friendly.
```

Note: Generic error message protects user privacy and doesn't reveal specific inappropriate content detected.

### 2. Card Type Validation

**Location:** `services/backend/src/adapters/rekognition-adapter.ts`

The `validateCardImage()` method checks Rekognition labels to ensure uploaded images are trading cards:

**Invalid Labels** (confidence > 80%):

- Person, Human, Face, Portrait
- Animal, Pet, Dog, Cat, Bird
- Food, Meal, Dish
- Vehicle, Car, Truck
- Building, Architecture
- Nature, Landscape
- Screen, Monitor, Television
- Furniture, Chair, Table

**Valid Labels** (confidence > 70%):

- Text, Document, Paper, Card
- Poster, Flyer, Advertisement
- Art, Drawing, Painting

**Validation Logic:**

- If invalid labels detected with high confidence AND no valid labels found → Reject
- Throws error: `Image does not appear to be a trading card. Detected: Person, Face`

### 3. Automatic Cleanup

**Location:** `services/backend/src/orchestration/rekognition-extract.ts`

When validation fails (either content safety or card type), the system automatically cleans up:

**Cleanup Process:**

1. Catch validation error in Rekognition Extract handler
2. Detect error type by checking error message:
   - Content safety: "inappropriate content"
   - Card type: "does not appear to be a trading card"
3. Call `deleteCard(userId, cardId, requestId, true)` with hard delete
4. Remove DynamoDB record and S3 objects (front + back)
5. Log cleanup success/failure with reason
6. Re-throw original validation error

**Benefits:**

- No orphaned S3 objects
- No incomplete DynamoDB records
- Clean state for retry
- Prevents storage costs for invalid/inappropriate uploads
- Maintains data consistency
- Protects kid-friendly environment

## User Experience

### Before Validation

User uploads inappropriate image → System processes it → Fails later with unclear error → Orphaned data in S3/DynamoDB → Inappropriate content stored

### After Validation

**Scenario 1: Inappropriate Content**
User uploads inappropriate image → Content moderation fails immediately → Clear error: "Image contains inappropriate content and cannot be uploaded. This app is kid-friendly." → All data cleaned up → User understands app is kid-friendly

**Scenario 2: Wrong Image Type**
User uploads image of their dog → Card validation fails immediately → Clear error: "Image does not appear to be a trading card. Detected: Dog, Animal" → All data cleaned up → User can retry with correct image

## Error Flow

### Content Safety Flow

```
User uploads inappropriate image
  ↓
S3 presigned URL upload succeeds
  ↓
DynamoDB card record created
  ↓
Step Functions triggers Rekognition Extract
  ↓
Rekognition DetectModerationLabels API called
  ↓
validateContentSafety() checks moderation labels
  ↓
Validation fails (inappropriate content detected)
  ↓
Error thrown: "Image contains inappropriate content and cannot be uploaded. This app is kid-friendly."
  ↓
Catch block detects content safety error
  ↓
deleteCard(userId, cardId, requestId, true) called
  ↓
S3 objects deleted (front + back)
  ↓
DynamoDB record deleted
  ↓
Cleanup logged with reason: "inappropriate content"
  ↓
Original validation error re-thrown to Step Functions
  ↓
User receives kid-friendly error message
```

### Card Type Validation Flow

```
User uploads non-card image (e.g., dog photo)
  ↓
S3 presigned URL upload succeeds
  ↓
DynamoDB card record created
  ↓
Step Functions triggers Rekognition Extract
  ↓
Rekognition DetectModerationLabels API called (passes)
  ↓
Rekognition DetectLabels API called
  ↓
validateCardImage() checks labels
  ↓
Validation fails (invalid labels detected)
  ↓
Error thrown: "Image does not appear to be a trading card. Detected: Dog"
  ↓
Catch block detects card validation error
  ↓
deleteCard(userId, cardId, requestId, true) called
  ↓
S3 objects deleted (front + back)
  ↓
DynamoDB record deleted
  ↓
Cleanup logged with reason: "invalid card type"
  ↓
Original validation error re-thrown to Step Functions
  ↓
User receives clear error message
```

## Configuration

### Tuning Thresholds

**If too many false positives (rejecting valid Pokémon cards):**

```typescript
// In rekognition-adapter.ts
const INVALID_CONFIDENCE_THRESHOLD = 90; // Increase from 80
const VALID_CONFIDENCE_THRESHOLD = 60; // Decrease from 70
```

**If too many false negatives (accepting non-cards):**

```typescript
const INVALID_CONFIDENCE_THRESHOLD = 70; // Decrease from 80
const VALID_CONFIDENCE_THRESHOLD = 80; // Increase from 70
```

### Adding More Labels

**Add valid labels for Pokémon cards:**

```typescript
const validLabels = [
  'Text',
  'Document',
  'Paper',
  'Card',
  'Poster',
  'Flyer',
  'Advertisement',
  'Art',
  'Drawing',
  'Painting',
  'Cartoon',
  'Animation',
  'Illustration', // New
];
```

## Monitoring

### Key Metrics

1. **Validation Rejection Rate**
   - Track: `isValidationError: true` in logs
   - Alert if > 10% of uploads rejected

2. **Cleanup Success Rate**
   - Track: "Invalid card upload cleaned up successfully"
   - Alert if cleanup failures > 1%

3. **Storage Savings**
   - Monitor S3 storage trends
   - Calculate savings from cleanup

4. **User Retry Rate**
   - Track users who retry after validation error
   - Measure success rate of retries

### CloudWatch Queries

**Find validation errors:**

```
fields @timestamp, userId, cardId, errorMessage
| filter isValidationError = true
| sort @timestamp desc
```

**Find cleanup failures:**

```
fields @timestamp, userId, cardId, error
| filter message = "Failed to clean up invalid card upload"
| sort @timestamp desc
```

## Testing

### Test Cases

1. **Valid card upload** → Should pass validation
2. **Photo of person** → Should reject with "Person, Face"
3. **Photo of dog** → Should reject with "Dog, Animal"
4. **Photo of food** → Should reject with "Food, Meal"
5. **Pokémon card with creature** → Should pass (has valid labels)
6. **Screenshot of card** → May reject (needs tuning)

### Manual Testing

```bash
# Upload valid card
curl -X POST https://api.collectiq.com/cards \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@pikachu_card.jpg"

# Upload invalid image (should fail and cleanup)
curl -X POST https://api.collectiq.com/cards \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@my_dog.jpg"

# Verify cleanup in CloudWatch Logs
aws logs tail /aws/lambda/rekognition-extract --follow
```

## Cost Impact

### Before Validation & Cleanup

- Invalid upload: $0.0026 (full Rekognition processing) + $0.0001 (S3 storage/month)
- Inappropriate upload: Same cost + brand risk + legal risk
- 1000 invalid uploads/month: $2.60 + $0.10/month storage = $2.70 + growing storage costs

### After Validation & Cleanup

**Content Safety Check:**

- DetectModerationLabels: $0.001 per image
- Blocks inappropriate content before processing

**Card Type Check:**

- DetectLabels: $0.001 per image
- Blocks non-cards before processing

**Total Cost per Invalid Upload:**

- $0.002 (both checks) + $0 (immediate cleanup)
- 1000 invalid uploads/month: $2.00
- No ongoing storage costs
- **25% cost reduction + safety benefits**

**Value Beyond Cost:**

- Kid-friendly compliance: Priceless
- Brand protection: Priceless
- Legal risk mitigation: Priceless
- User trust: Priceless

## Future Improvements

1. **Custom ML Model**
   - Train model specifically for trading card detection
   - Higher accuracy for Pokémon cards with creatures
   - Reduce false positives

2. **Client-Side Pre-Validation**
   - Use TensorFlow.js for browser-side validation
   - Fail before upload to save bandwidth
   - Provide instant feedback

3. **Validation Feedback Loop**
   - Collect user feedback on false positives
   - Automatically adjust thresholds
   - Improve over time

4. **Multi-Image Validation**
   - Require 2-3 angles of card
   - Cross-validate between images
   - Higher confidence in validation

## Related Files

- `services/backend/src/adapters/rekognition-adapter.ts` - Validation logic
- `services/backend/src/orchestration/rekognition-extract.ts` - Cleanup logic
- `services/backend/src/store/card-service.ts` - Delete function
- `REKOGNITION_EXTRACT_DOCUMENTATION.md` - Full documentation
