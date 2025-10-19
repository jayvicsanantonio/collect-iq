# Frontend-Backend Integration Guide

## Overview

This document provides a comprehensive guide for integrating the CollectIQ frontend with the backend APIs. It outlines all available endpoints, request/response formats, and implementation patterns for building the authenticated user experience.

## Backend API Endpoints

### Base URL

```
Production: https://api.collectiq.com
Development: https://api-dev.collectiq.com
Local: http://localhost:3001
```

All endpoints require JWT authentication via HTTP-only cookies (set by Cognito OAuth callback).

## API Endpoints Reference

### 1. Upload Presign

**Endpoint:** `POST /upload/presign`

**Purpose:** Generate a presigned S3 URL for direct image upload

**Request:**

```typescript
{
  filename: string; // Original filename (max 255 chars)
  contentType: string; // Must be: image/jpeg, image/png, or image/heic
  sizeBytes: number; // File size in bytes (max 12MB = 12,582,912 bytes)
}
```

**Response:** `200 OK`

```typescript
{
  uploadUrl: string; // Presigned S3 URL (expires in 60 seconds)
  key: string; // S3 key: uploads/{userId}/{uuid}-{filename}
  expiresIn: number; // Expiration time in seconds (60)
}
```

**Headers:**

- `Content-Type: application/json`

**Errors:**

- `400 Bad Request` - Invalid content type or file size
- `413 Payload Too Large` - File exceeds 12MB
- `415 Unsupported Media Type` - Invalid content type

**Implementation Notes:**

- Upload directly to S3 using the presigned URL with PUT request
- Set `Content-Type` header to match the requested contentType
- Track upload progress using XMLHttpRequest
- After successful S3 upload, create card record via POST /cards

---

### 2. Create Card

**Endpoint:** `POST /cards`

**Purpose:** Create a new card record and trigger Step Functions analysis workflow

**Headers:**

- `Content-Type: application/json`
- `Idempotency-Key: {uuid}` (REQUIRED) - Prevents duplicate card creation

**Request:**

```typescript
{
  frontS3Key: string;              // S3 key from presign response (required)
  backS3Key?: string;              // Optional back image S3 key
  name?: string;                   // Optional card name (for manual entry)
  set?: string;                    // Optional set name
  number?: string;                 // Optional card number
  rarity?: string;                 // Optional rarity
  conditionEstimate?: string;      // Optional condition estimate
}
```

**Response:** `201 Created`

```typescript
{
  cardId: string;                  // UUID
  userId: string;                  // Cognito sub
  name?: string;
  set?: string;
  number?: string;
  rarity?: string;
  conditionEstimate?: string;
  frontS3Key: string;
  backS3Key?: string;
  idConfidence?: number;           // 0-1 (populated after analysis)
  authenticityScore?: number;      // 0-1 (populated after analysis)
  authenticitySignals?: {
    visualHashConfidence: number;  // 0-1
    textMatchConfidence: number;   // 0-1
    holoPatternConfidence: number; // 0-1
    borderConsistency: number;     // 0-1
    fontValidation: number;        // 0-1
  };
  valueLow?: number;               // USD (populated after analysis)
  valueMedian?: number;            // USD (populated after analysis)
  valueHigh?: number;              // USD (populated after analysis)
  compsCount?: number;             // Number of comparable sales
  sources?: string[];              // ['eBay', 'TCGPlayer', 'PriceCharting']
  createdAt: string;               // ISO 8601 datetime
  updatedAt: string;               // ISO 8601 datetime
}
```

**Errors:**

- `400 Bad Request` - Missing frontS3Key or invalid data
- `409 Conflict` - Duplicate Idempotency-Key

**Implementation Notes:**

- Generate a UUID for Idempotency-Key header
- Store the Idempotency-Key to prevent duplicate submissions
- Card is created immediately, but analysis fields (authenticityScore, valueLow, etc.) are undefined
- Step Functions workflow runs asynchronously to populate analysis fields
- Poll GET /cards/{id} to check for updated analysis results

---

### 3. List Cards

**Endpoint:** `GET /cards?cursor={cursor}&limit={limit}`

**Purpose:** Retrieve user's card collection with pagination

**Query Parameters:**

- `cursor` (optional): Pagination cursor from previous response
- `limit` (optional): Number of items per page (1-100, default: 20)

**Response:** `200 OK`

```typescript
{
  items: Card[];           // Array of Card objects (see Create Card response)
  nextCursor?: string;     // Cursor for next page (undefined if no more items)
}
```

**Errors:**

- `400 Bad Request` - Invalid limit (must be 1-100)

**Implementation Notes:**

- Use cursor-based pagination for efficient large collections
- Store nextCursor to implement "Load More" or infinite scroll
- Filter and sort client-side for better UX (backend returns all user's cards)
- Calculate portfolio stats client-side from items array

---

### 4. Get Card

**Endpoint:** `GET /cards/{id}`

**Purpose:** Retrieve a specific card by ID

**Path Parameters:**

- `id`: Card UUID

**Response:** `200 OK`

```typescript
Card; // Same structure as Create Card response
```

**Errors:**

- `400 Bad Request` - Missing or invalid card ID
- `403 Forbidden` - User doesn't own this card
- `404 Not Found` - Card doesn't exist or was deleted

**Implementation Notes:**

- Use for card detail view
- Poll this endpoint to check for updated analysis results after card creation
- Check if authenticityScore and valueLow are defined to determine if analysis is complete

---

### 5. Delete Card

**Endpoint:** `DELETE /cards/{id}`

**Purpose:** Delete a card (soft delete by default)

**Path Parameters:**

- `id`: Card UUID

**Response:** `204 No Content`

**Errors:**

- `400 Bad Request` - Missing or invalid card ID
- `403 Forbidden` - User doesn't own this card
- `404 Not Found` - Card doesn't exist

**Implementation Notes:**

- Soft delete by default (sets deletedAt timestamp)
- Hard delete can be configured via HARD_DELETE_CARDS environment variable
- Implement optimistic UI update (remove from list immediately)
- Rollback on error (restore to list)

---

### 6. Revalue Card

**Endpoint:** `POST /cards/{id}/revalue`

**Purpose:** Trigger Step Functions workflow to refresh card valuation and authenticity

**Headers:**

- `Content-Type: application/json`
- `Idempotency-Key: {uuid}` (REQUIRED) - Prevents duplicate executions

**Path Parameters:**

- `id`: Card UUID

**Request:**

```typescript
{
  forceRefresh?: boolean;  // Default: false. If true, bypasses pricing cache
}
```

**Response:** `202 Accepted`

```typescript
{
  executionArn: string; // Step Functions execution ARN
  status: 'RUNNING'; // Always 'RUNNING' for new executions
  message: string; // Human-readable message
}
```

**Errors:**

- `400 Bad Request` - Missing or invalid card ID, or card missing frontS3Key
- `403 Forbidden` - User doesn't own this card
- `404 Not Found` - Card doesn't exist

**Implementation Notes:**

- Generate a new UUID for Idempotency-Key header
- If an execution is already running for this card, returns existing executionArn
- Poll GET /cards/{id} to check for updated valuation data
- Display loading state while polling
- Show toast notification when new data is available

---

## Frontend Implementation Patterns

### Pattern 1: Upload Flow

```typescript
// 1. Request presigned URL
const presignResponse = await api.getPresignedUrl({
  filename: file.name,
  contentType: file.type,
  sizeBytes: file.size,
});

// 2. Upload to S3 with progress tracking
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (event) => {
  const progress = (event.loaded / event.total) * 100;
  setUploadProgress(progress);
});

await new Promise((resolve, reject) => {
  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) resolve();
    else reject(new Error(`Upload failed: ${xhr.status}`));
  });
  xhr.open('PUT', presignResponse.uploadUrl);
  xhr.setRequestHeader('Content-Type', file.type);
  xhr.send(file);
});

// 3. Create card record
const idempotencyKey = uuidv4();
const card = await api.createCard({ frontS3Key: presignResponse.key }, idempotencyKey);

// 4. Redirect to card detail/processing view
router.push(`/cards/${card.cardId}`);
```

### Pattern 2: Card Processing with Polling

```typescript
// Poll for analysis results
const pollForAnalysis = async (cardId: string) => {
  const maxAttempts = 60; // 60 attempts = 5 minutes
  const pollInterval = 5000; // 5 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const card = await api.getCard(cardId);

    // Check if analysis is complete
    if (card.authenticityScore !== undefined && card.valueLow !== undefined) {
      return card; // Analysis complete
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Analysis timeout');
};

// Usage in component
useEffect(() => {
  if (!card.authenticityScore || !card.valueLow) {
    pollForAnalysis(card.cardId)
      .then((updatedCard) => setCard(updatedCard))
      .catch((error) => setError(error));
  }
}, [card.cardId]);
```

### Pattern 3: Vault with Pagination

```typescript
const [cards, setCards] = useState<Card[]>([]);
const [nextCursor, setNextCursor] = useState<string | undefined>();
const [isLoading, setIsLoading] = useState(false);

// Initial load
useEffect(() => {
  const loadCards = async () => {
    setIsLoading(true);
    const response = await api.getCards({ limit: 20 });
    setCards(response.items);
    setNextCursor(response.nextCursor);
    setIsLoading(false);
  };
  loadCards();
}, []);

// Load more
const loadMore = async () => {
  if (!nextCursor || isLoading) return;

  setIsLoading(true);
  const response = await api.getCards({ cursor: nextCursor, limit: 20 });
  setCards((prev) => [...prev, ...response.items]);
  setNextCursor(response.nextCursor);
  setIsLoading(false);
};
```

### Pattern 4: Revaluation with Polling

```typescript
const refreshValuation = async (cardId: string) => {
  // Trigger revaluation
  const idempotencyKey = uuidv4();
  const response = await api.revalueCard(cardId, { forceRefresh: true }, idempotencyKey);

  toast({
    title: 'Revaluation started',
    description: 'Checking for updated pricing...',
  });

  // Poll for updated data
  const pollForUpdate = async () => {
    const maxAttempts = 30; // 30 attempts = 2.5 minutes
    const pollInterval = 5000; // 5 seconds
    const originalCard = await api.getCard(cardId);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const updatedCard = await api.getCard(cardId);

      // Check if valuation changed
      if (updatedCard.updatedAt !== originalCard.updatedAt) {
        return updatedCard;
      }
    }

    throw new Error('Revaluation timeout');
  };

  try {
    const updatedCard = await pollForUpdate();
    setCard(updatedCard);
    toast({
      title: 'Valuation updated',
      description: 'Your card has been revalued.',
    });
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Revaluation timeout',
      description: 'Please try again later.',
    });
  }
};
```

### Pattern 5: Optimistic Delete

```typescript
const deleteCard = async (cardId: string) => {
  // Store original state for rollback
  const originalCards = [...cards];

  // Optimistic update
  setCards((prev) => prev.filter((c) => c.cardId !== cardId));

  try {
    await api.deleteCard(cardId);
    toast({
      title: 'Card deleted',
      description: 'Your card has been removed.',
    });
  } catch (error) {
    // Rollback on error
    setCards(originalCards);
    toast({
      variant: 'destructive',
      title: 'Delete failed',
      description: 'Please try again.',
    });
  }
};
```

## Error Handling

All errors follow RFC 7807 ProblemDetails format:

```typescript
interface ProblemDetails {
  type: string; // URI reference (e.g., '/errors/bad-request')
  title: string; // Short summary (e.g., 'Bad Request')
  status: number; // HTTP status code (e.g., 400)
  detail: string; // Human-readable explanation
  instance?: string; // URI reference to specific occurrence
  requestId?: string; // For traceability
}
```

### Common Error Responses

| Status | Title                  | Common Causes                          | User Message                                         |
| ------ | ---------------------- | -------------------------------------- | ---------------------------------------------------- |
| 400    | Bad Request            | Invalid input, missing required fields | "Invalid request. Please check your input."          |
| 401    | Unauthorized           | Missing or expired JWT                 | "Your session expired. Please sign in again."        |
| 403    | Forbidden              | Accessing another user's card          | "You don't have access to this card."                |
| 404    | Not Found              | Card doesn't exist                     | "Card not found."                                    |
| 409    | Conflict               | Duplicate Idempotency-Key              | "This request was already processed."                |
| 413    | Payload Too Large      | File exceeds 12MB                      | "Image too large. Maximum size is 12MB."             |
| 415    | Unsupported Media Type | Invalid content type                   | "Unsupported file type. Use JPG, PNG, or HEIC."      |
| 429    | Too Many Requests      | Rate limit exceeded                    | "Too many requests. Please try again in {seconds}s." |
| 500    | Internal Server Error  | Backend error                          | "Something went wrong. Please try again."            |
| 502    | Bad Gateway            | Upstream service error                 | "Service temporarily unavailable."                   |
| 503    | Service Unavailable    | Service down                           | "Service temporarily unavailable."                   |
| 504    | Gateway Timeout        | Request timeout                        | "Request timeout. Please try again."                 |

## Idempotency

POST endpoints require an `Idempotency-Key` header to prevent duplicate operations:

```typescript
import { v4 as uuidv4 } from 'uuid';

// Generate unique key for each operation
const idempotencyKey = uuidv4();

// Store key to prevent duplicate submissions
sessionStorage.setItem(`idempotency-${operation}`, idempotencyKey);

// Include in request
await api.createCard(data, idempotencyKey);
```

**Key Points:**

- Generate a new UUID for each unique operation
- Store the key to prevent duplicate submissions (e.g., double-click)
- Backend returns 409 Conflict if key is reused
- Keys expire after 10 minutes (configurable via IDEMPOTENCY_TTL_SECONDS)

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│                                                                  │
│  1. Upload Image → POST /upload/presign                         │
│  2. Upload to S3 → PUT {presignedUrl}                           │
│  3. Create Card → POST /cards (with frontS3Key)                 │
│  4. Poll Status → GET /cards/{id} (check for analysis results)  │
│  5. Display Results → Show authenticity + valuation             │
│  6. Refresh → POST /cards/{id}/revalue (trigger re-analysis)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (API Gateway + Lambda)                │
│                                                                  │
│  • JWT Authentication (Cognito)                                 │
│  • Request Validation (Zod schemas)                             │
│  • Idempotency Checks (DynamoDB)                                │
│  • Step Functions Orchestration                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Step Functions Workflow                        │
│                                                                  │
│  1. Rekognition Extract → Feature extraction from image         │
│  2. Parallel Agents:                                            │
│     • Pricing Agent → Multi-source valuation                    │
│     • Authenticity Agent → Fake detection                       │
│  3. Aggregator → Update card record in DynamoDB                 │
│  4. EventBridge → Emit card update event                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Frontend Page Structure

### 1. Upload Page (`/upload`)

**Purpose:** Upload card images

**Components:**

- UploadDropzone (drag-and-drop + file picker)
- CameraCapture (mobile camera integration)
- UploadProgress (progress bar + thumbnail)

**Flow:**

1. User selects/captures image
2. Validate file (type, size)
3. Request presigned URL
4. Upload to S3 with progress
5. Create card record
6. Redirect to card detail/processing

---

### 2. Card Detail Page (`/cards/{id}`)

**Purpose:** Display card details, authenticity, and valuation

**Components:**

- CardImage (zoomable image from S3)
- AuthenticityBadge (score + signals breakdown)
- ValuationPanel (price range + sources)
- CardActions (re-evaluate, delete, share)
- CardProcessing (loading state while analysis runs)

**States:**

- **Processing:** authenticityScore or valueLow undefined → Show loading state + poll
- **Complete:** All fields populated → Show full details
- **Error:** Analysis failed → Show error + retry button

**Flow:**

1. Fetch card via GET /cards/{id}
2. If processing, poll for updates every 5 seconds
3. Display results when complete
4. Allow re-evaluation via POST /cards/{id}/revalue

---

### 3. Vault Page (`/vault`)

**Purpose:** Browse and manage card collection

**Components:**

- PortfolioSummary (total value, card count, sparkline)
- VaultFilters (filter by set, rarity, authenticity)
- VaultGrid (responsive card grid)
- LoadMore (pagination button)

**Flow:**

1. Fetch cards via GET /cards
2. Calculate portfolio stats client-side
3. Apply filters/sorting client-side
4. Load more with cursor pagination
5. Quick actions: refresh, delete

---

## Testing Strategy

### Unit Tests

- API client methods
- Zod schema validation
- Error parsing (ProblemDetails)
- Component logic

### Integration Tests

- Upload flow (presign → S3 → create card)
- Polling logic (check for analysis results)
- Pagination (cursor-based)
- Optimistic updates (delete with rollback)

### E2E Tests

- Complete upload → analysis → detail flow
- Revaluation flow
- Vault browsing and filtering
- Error handling (401, 403, 404, etc.)

## Security Considerations

1. **Authentication:** All requests include JWT in HTTP-only cookies
2. **Idempotency:** Prevent duplicate operations with Idempotency-Key
3. **Validation:** Client-side validation mirrors backend Zod schemas
4. **Error Handling:** Never expose sensitive backend details
5. **CORS:** API Gateway configured for frontend domain only
6. **CSP:** Strict Content Security Policy prevents XSS

## Performance Optimization

1. **Code Splitting:** Lazy load Recharts and heavy components
2. **Image Optimization:** Use Next.js Image component with blur placeholders
3. **Caching:** SWR for client-side data caching
4. **Polling:** Exponential backoff for long-running operations
5. **Virtualization:** For large card collections (>200 items)
6. **Optimistic Updates:** Immediate UI feedback for mutations

## Next Steps

1. **Phase 1: Core Upload Flow**
   - Implement upload page with presign + S3 upload
   - Create card record after successful upload
   - Build card processing/detail page with polling

2. **Phase 2: Vault Management**
   - Build vault page with pagination
   - Implement filters and sorting
   - Add portfolio summary calculations

3. **Phase 3: Revaluation**
   - Implement refresh valuation flow
   - Add polling for updated data
   - Display loading states

4. **Phase 4: Polish**
   - Error handling and retry logic
   - Loading states and skeletons
   - Toast notifications
   - Accessibility improvements

5. **Phase 5: Testing**
   - Unit tests for API client
   - Integration tests for flows
   - E2E tests for critical paths
   - Performance testing
