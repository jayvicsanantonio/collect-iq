# Card Operations Flow: GET, LIST, DELETE

## Overview

This document explains how the `cards_get`, `cards_list`, and `cards_delete` Lambda functions work, which AWS services they connect to, and the complete data flow.

---

## Quick Answer

All three Lambda functions connect to **DynamoDB only**. They do NOT connect to S3, Rekognition, Bedrock, or any other AWS service.

```
┌──────────────────────────────────────────────────────────────┐
│  cards_get    → DynamoDB (GetItem)                           │
│  cards_list   → DynamoDB (Query with GSI1)                   │
│  cards_delete → DynamoDB (GetItem + DeleteItem/UpdateItem)   │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. `cards_get` Lambda - Get Single Card

### What It Does

Retrieves a specific card by ID for the authenticated user.

### AWS Services Connected

**Only DynamoDB:**

- Operation: `GetItem`
- Table: `collectiq-hackathon-cards`
- Access Pattern: Direct key lookup

### Data Flow

```
┌──────────┐
│ Frontend │
└────┬─────┘
     │
     │ GET /cards/{cardId}
     │ Headers: Authorization: Bearer {JWT}
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         API Gateway (JWT Authorizer)                │
│  ✓ Validates JWT token                             │
│  ✓ Extracts user ID (sub claim)                    │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         cards_get Lambda                            │
│                                                     │
│  1. Extract userId from JWT                        │
│  2. Extract cardId from path parameter             │
│  3. Call DynamoDB GetItem                          │
│  4. Verify card belongs to user                    │
│  5. Return card data                               │
└────┬────────────────────────────────────────────────┘
     │
     │ DynamoDB.GetItem({
     │   TableName: "collectiq-hackathon-cards",
     │   Key: {
     │     PK: "USER#user123",
     │     SK: "CARD#cardId"
     │   }
     │ })
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              DynamoDB Table                         │
│                                                     │
│  PK: USER#user123                                  │
│  SK: CARD#abc-123                                  │
│  ├─ cardId: "abc-123"                              │
│  ├─ userId: "user123"                              │
│  ├─ frontS3Key: "uploads/user123/uuid-file.jpg"   │
│  ├─ name: "Charizard"                              │
│  ├─ set: "Base Set"                                │
│  ├─ authenticityScore: 0.92                        │
│  ├─ valueMedian: 450.00                            │
│  └─ ... other fields                               │
└─────────────────────────────────────────────────────┘
     │
     │ Returns card item
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         cards_get Lambda                            │
│  ✓ Verifies userId matches (ownership check)       │
│  ✓ Returns 200 OK with card data                   │
│  ✗ Returns 404 if not found                        │
│  ✗ Returns 403 if user doesn't own card            │
└─────────────────────────────────────────────────────┘
```

### IAM Permissions

```hcl
# cards_get Lambda IAM Policy
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem"  # Read single item
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-1:123456789012:table/collectiq-hackathon-cards"
  ]
}
```

### Code Flow

```typescript
// services/backend/src/handlers/cards_get.ts

export async function handler(event) {
  // 1. Authenticate user
  const userId = getUserId(event); // From JWT token

  // 2. Get cardId from path
  const cardId = event.pathParameters?.id;

  // 3. Fetch from DynamoDB
  const card = await getCard(userId, cardId, requestId);

  // 4. Return card
  return {
    statusCode: 200,
    body: JSON.stringify(card),
  };
}
```

```typescript
// services/backend/src/store/card-service.ts

export async function getCard(userId, cardId, requestId) {
  const client = getDynamoDBClient();

  // DynamoDB GetItem operation
  const result = await client.send(
    new GetCommand({
      TableName: getTableName(),
      Key: {
        PK: `USER#${userId}`,
        SK: `CARD#${cardId}`,
      },
    })
  );

  if (!result.Item) {
    throw new NotFoundError('Card not found');
  }

  // Verify ownership
  if (result.Item.userId !== userId) {
    throw new ForbiddenError('Access denied');
  }

  return result.Item;
}
```

### Response Example

```json
{
  "cardId": "abc-123",
  "userId": "user123",
  "frontS3Key": "uploads/user123/uuid-charizard.jpg",
  "name": "Charizard",
  "set": "Base Set",
  "number": "4",
  "rarity": "Holo Rare",
  "authenticityScore": 0.92,
  "valueLow": 350.0,
  "valueMedian": 450.0,
  "valueHigh": 600.0,
  "compsCount": 15,
  "sources": ["ebay", "tcgplayer"],
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:35:00Z"
}
```

---

## 2. `cards_list` Lambda - List User's Cards

### What It Does

Lists all cards for the authenticated user with pagination support.

### AWS Services Connected

**Only DynamoDB:**

- Operation: `Query`
- Table: `collectiq-hackathon-cards`
- Index: `GSI1` (Global Secondary Index)
- Access Pattern: Query by userId

### Data Flow

```
┌──────────┐
│ Frontend │
└────┬─────┘
     │
     │ GET /cards?limit=20&cursor=eyJjYXJk...
     │ Headers: Authorization: Bearer {JWT}
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         API Gateway (JWT Authorizer)                │
│  ✓ Validates JWT token                             │
│  ✓ Extracts user ID (sub claim)                    │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         cards_list Lambda                           │
│                                                     │
│  1. Extract userId from JWT                        │
│  2. Parse query parameters (limit, cursor)         │
│  3. Call DynamoDB Query on GSI1                    │
│  4. Return paginated results                       │
└────┬────────────────────────────────────────────────┘
     │
     │ DynamoDB.Query({
     │   TableName: "collectiq-hackathon-cards",
     │   IndexName: "GSI1",
     │   KeyConditionExpression: "PK = :pk",
     │   ExpressionAttributeValues: {
     │     ":pk": "USER#user123"
     │   },
     │   Limit: 20,
     │   ExclusiveStartKey: cursor
     │ })
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         DynamoDB Table (GSI1 Query)                 │
│                                                     │
│  Query all items where PK = "USER#user123"         │
│                                                     │
│  Results:                                           │
│  ├─ CARD#abc-123 (Charizard)                       │
│  ├─ CARD#def-456 (Pikachu)                         │
│  ├─ CARD#ghi-789 (Blastoise)                       │
│  └─ ... more cards                                  │
└─────────────────────────────────────────────────────┘
     │
     │ Returns items + LastEvaluatedKey (for pagination)
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         cards_list Lambda                           │
│  ✓ Formats response with items array               │
│  ✓ Encodes LastEvaluatedKey as nextCursor          │
│  ✓ Returns 200 OK with paginated results           │
└─────────────────────────────────────────────────────┘
```

### IAM Permissions

```hcl
# cards_list Lambda IAM Policy
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:Query"  # Query items by partition key
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-1:123456789012:table/collectiq-hackathon-cards",
    "arn:aws:dynamodb:us-east-1:123456789012:table/collectiq-hackathon-cards/index/GSI1"
  ]
}
```

### Why GSI1 (Global Secondary Index)?

**Problem:** DynamoDB requires you to know both PK and SK for efficient queries. We want to list ALL cards for a user without knowing their cardIds.

**Solution:** GSI1 allows querying by userId alone.

```
Main Table:
PK: USER#user123, SK: CARD#abc-123
PK: USER#user123, SK: CARD#def-456
PK: USER#user123, SK: CARD#ghi-789

GSI1 (allows querying by PK only):
GSI1PK: USER#user123, GSI1SK: CARD#abc-123
GSI1PK: USER#user123, GSI1SK: CARD#def-456
GSI1PK: USER#user123, GSI1SK: CARD#ghi-789

Query: "Give me all items where GSI1PK = USER#user123"
Result: All cards for user123
```

### Code Flow

```typescript
// services/backend/src/handlers/cards_list.ts

export async function handler(event) {
  // 1. Authenticate user
  const userId = getUserId(event);

  // 2. Parse pagination parameters
  const limit = event.queryStringParameters?.limit || 20;
  const cursor = event.queryStringParameters?.cursor;

  // 3. Query DynamoDB
  const result = await listCards(userId, { limit, cursor }, requestId);

  // 4. Return paginated results
  return {
    statusCode: 200,
    body: JSON.stringify({
      items: result.items,
      nextCursor: result.nextCursor,
    }),
  };
}
```

```typescript
// services/backend/src/store/card-service.ts

export async function listCards(userId, options, requestId) {
  const client = getDynamoDBClient();

  // DynamoDB Query operation on GSI1
  const result = await client.send(
    new QueryCommand({
      TableName: getTableName(),
      IndexName: 'GSI1',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
      },
      Limit: options.limit || 20,
      ExclusiveStartKey: options.cursor ? decodeCursor(options.cursor) : undefined,
    })
  );

  return {
    items: result.Items || [],
    nextCursor: result.LastEvaluatedKey ? encodeCursor(result.LastEvaluatedKey) : undefined,
  };
}
```

### Response Example

```json
{
  "items": [
    {
      "cardId": "abc-123",
      "name": "Charizard",
      "set": "Base Set",
      "valueMedian": 450.0,
      "authenticityScore": 0.92,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "cardId": "def-456",
      "name": "Pikachu",
      "set": "Jungle",
      "valueMedian": 25.0,
      "authenticityScore": 0.88,
      "createdAt": "2024-01-14T15:20:00Z"
    }
  ],
  "nextCursor": "eyJQSyI6IlVTRVIjdXNlcjEyMyIsIlNLIjoiQ0FSRCN..."
}
```

---

## 3. `cards_delete` Lambda - Delete Card

### What It Does

Deletes a card (soft delete by default) for the authenticated user.

### AWS Services Connected

**Only DynamoDB:**

- Operations: `GetItem` (verify ownership) + `DeleteItem` or `UpdateItem` (soft delete)
- Table: `collectiq-hackathon-cards`
- Access Pattern: Direct key lookup

### Data Flow

```
┌──────────┐
│ Frontend │
└────┬─────┘
     │
     │ DELETE /cards/{cardId}
     │ Headers: Authorization: Bearer {JWT}
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         API Gateway (JWT Authorizer)                │
│  ✓ Validates JWT token                             │
│  ✓ Extracts user ID (sub claim)                    │
└────┬────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         cards_delete Lambda                         │
│                                                     │
│  1. Extract userId from JWT                        │
│  2. Extract cardId from path parameter             │
│  3. Call DynamoDB GetItem (verify ownership)       │
│  4. Call DynamoDB DeleteItem or UpdateItem         │
│  5. Return 204 No Content                          │
└────┬────────────────────────────────────────────────┘
     │
     │ Step 1: Verify ownership
     │ DynamoDB.GetItem({
     │   TableName: "collectiq-hackathon-cards",
     │   Key: {
     │     PK: "USER#user123",
     │     SK: "CARD#cardId"
     │   }
     │ })
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              DynamoDB Table                         │
│  ✓ Card exists                                      │
│  ✓ Card belongs to user                            │
└─────────────────────────────────────────────────────┘
     │
     │ Step 2: Delete (soft or hard)
     │
     │ Soft Delete (default):
     │ DynamoDB.UpdateItem({
     │   TableName: "collectiq-hackathon-cards",
     │   Key: { PK: "USER#user123", SK: "CARD#cardId" },
     │   UpdateExpression: "SET deletedAt = :now",
     │   ExpressionAttributeValues: {
     │     ":now": "2024-01-15T10:40:00Z"
     │   }
     │ })
     │
     │ Hard Delete (if HARD_DELETE_CARDS=true):
     │ DynamoDB.DeleteItem({
     │   TableName: "collectiq-hackathon-cards",
     │   Key: { PK: "USER#user123", SK: "CARD#cardId" }
     │ })
     │
     ▼
┌─────────────────────────────────────────────────────┐
│         cards_delete Lambda                         │
│  ✓ Returns 204 No Content                          │
│  ✗ Returns 404 if card not found                   │
│  ✗ Returns 403 if user doesn't own card            │
└─────────────────────────────────────────────────────┘
```

### IAM Permissions

```hcl
# cards_delete Lambda IAM Policy
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:GetItem",    # Verify ownership
    "dynamodb:DeleteItem"  # Delete item (or UpdateItem for soft delete)
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-1:123456789012:table/collectiq-hackathon-cards"
  ]
}
```

### Soft Delete vs Hard Delete

**Soft Delete (Default):**

- Sets `deletedAt` timestamp
- Card remains in database
- Can be restored later
- Better for audit trails
- GDPR-compliant (can be purged later)

**Hard Delete:**

- Permanently removes card from database
- Cannot be restored
- Enabled via `HARD_DELETE_CARDS=true` environment variable

### Code Flow

```typescript
// services/backend/src/handlers/cards_delete.ts

export async function handler(event) {
  // 1. Authenticate user
  const userId = getUserId(event);

  // 2. Get cardId from path
  const cardId = event.pathParameters?.id;

  // 3. Check delete mode
  const hardDelete = process.env.HARD_DELETE_CARDS === 'true';

  // 4. Delete from DynamoDB
  await deleteCard(userId, cardId, requestId, hardDelete);

  // 5. Return 204 No Content
  return {
    statusCode: 204,
    body: '',
  };
}
```

```typescript
// services/backend/src/store/card-service.ts

export async function deleteCard(userId, cardId, requestId, hardDelete = false) {
  const client = getDynamoDBClient();

  // Step 1: Verify ownership
  const card = await getCard(userId, cardId, requestId);

  if (hardDelete) {
    // Hard delete: Remove from database
    await client.send(
      new DeleteCommand({
        TableName: getTableName(),
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
      })
    );
  } else {
    // Soft delete: Set deletedAt timestamp
    await client.send(
      new UpdateCommand({
        TableName: getTableName(),
        Key: {
          PK: `USER#${userId}`,
          SK: `CARD#${cardId}`,
        },
        UpdateExpression: 'SET deletedAt = :now',
        ExpressionAttributeValues: {
          ':now': new Date().toISOString(),
        },
      })
    );
  }
}
```

### Response

```
HTTP/1.1 204 No Content
Content-Length: 0
```

---

## Summary Table

| Lambda Function | AWS Service | DynamoDB Operation                    | IAM Permission                            | Purpose                               |
| --------------- | ----------- | ------------------------------------- | ----------------------------------------- | ------------------------------------- |
| `cards_get`     | DynamoDB    | `GetItem`                             | `dynamodb:GetItem`                        | Get single card by ID                 |
| `cards_list`    | DynamoDB    | `Query` (GSI1)                        | `dynamodb:Query`                          | List all user's cards with pagination |
| `cards_delete`  | DynamoDB    | `GetItem` + `DeleteItem`/`UpdateItem` | `dynamodb:GetItem`, `dynamodb:DeleteItem` | Delete card (soft or hard)            |

---

## Key Points

### 1. **DynamoDB Only**

All three Lambda functions connect ONLY to DynamoDB. They do NOT:

- ❌ Connect to S3 (S3 keys are stored as strings in DynamoDB)
- ❌ Connect to Rekognition
- ❌ Connect to Bedrock
- ❌ Connect to Step Functions
- ❌ Connect to EventBridge

### 2. **User-Scoped Data**

All operations are scoped to the authenticated user:

```
PK: USER#{userId}  ← Partition key ensures data isolation
SK: CARD#{cardId}  ← Sort key identifies specific card
```

### 3. **Ownership Verification**

Every operation verifies the user owns the card:

```typescript
if (card.userId !== userId) {
  throw new ForbiddenError('Access denied');
}
```

### 4. **Efficient Queries**

- `cards_get`: Direct key lookup (O(1))
- `cards_list`: GSI1 query (O(n) where n = user's cards)
- `cards_delete`: Direct key lookup + delete (O(1))

### 5. **S3 Images**

The Lambda functions return S3 keys (strings), not actual images:

```json
{
  "frontS3Key": "uploads/user123/uuid-charizard.jpg"
}
```

The frontend then:

1. Gets presigned URL for the S3 key
2. Fetches image directly from S3
3. Displays image to user

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Card Operations Flow                         │
└─────────────────────────────────────────────────────────────────┘

Frontend
   │
   ├─ GET /cards/{id} ────────────► cards_get Lambda
   │                                      │
   │                                      ▼
   │                                 DynamoDB.GetItem
   │                                      │
   │                                      ▼
   │                                 Return card data
   │
   ├─ GET /cards ─────────────────► cards_list Lambda
   │                                      │
   │                                      ▼
   │                                 DynamoDB.Query (GSI1)
   │                                      │
   │                                      ▼
   │                                 Return cards array
   │
   └─ DELETE /cards/{id} ─────────► cards_delete Lambda
                                          │
                                          ▼
                                     DynamoDB.GetItem (verify)
                                          │
                                          ▼
                                     DynamoDB.DeleteItem/UpdateItem
                                          │
                                          ▼
                                     Return 204 No Content

All operations:
✓ Authenticated via JWT
✓ User-scoped (PK = USER#{userId})
✓ Ownership verified
✓ DynamoDB only (no other AWS services)
```

---

## Performance & Cost

### Latency

- `cards_get`: ~100ms (single GetItem)
- `cards_list`: ~150ms (Query with 20 items)
- `cards_delete`: ~150ms (GetItem + DeleteItem)

### Cost (per 10,000 operations)

**DynamoDB:**

- Read capacity: $0.25 per million reads
- Write capacity: $1.25 per million writes

**Lambda:**

- Requests: 10,000 × $0.0000002 = $0.002
- Compute: 10,000 × 0.1s × 512MB × $0.0000166667 = $8.33

**Total per 10,000 operations:**

- `cards_get`: $8.33 (Lambda) + $0.0025 (DynamoDB) = $8.33
- `cards_list`: $8.33 (Lambda) + $0.0025 (DynamoDB) = $8.33
- `cards_delete`: $8.33 (Lambda) + $0.0125 (DynamoDB) = $8.34

---

## Security

### Authentication

- JWT token validated by API Gateway
- User ID extracted from token
- No anonymous access

### Authorization

- User-scoped partition keys
- Ownership verification on every operation
- Cannot access other users' cards

### Data Isolation

```
User A: PK = USER#userA
  ├─ CARD#card1
  ├─ CARD#card2
  └─ CARD#card3

User B: PK = USER#userB
  ├─ CARD#card4
  ├─ CARD#card5
  └─ CARD#card6

User A cannot access User B's cards (different partition key)
```

---

## Related Documentation

- [Upload Flow Explained](./UPLOAD_FLOW_EXPLAINED.md)
- [API Flow Documentation](./API_FLOW.md)
- [DynamoDB Single-Table Design](../infra/terraform/modules/dynamodb_collectiq/README.md)

---

**Last Updated:** 2024-01-15  
**Maintained By:** CollectIQ Engineering Team
