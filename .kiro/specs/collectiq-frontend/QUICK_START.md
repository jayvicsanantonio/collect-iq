# Frontend Quick Start Guide

## Overview

This guide provides everything you need to start building the CollectIQ frontend, aligned with the actual backend implementation.

## Project Structure

```
apps/web/
├── app/
│   ├── (public)/
│   │   └── auth/callback/          # OAuth callback handler
│   ├── (protected)/
│   │   ├── upload/                 # Card upload page
│   │   ├── vault/                  # Collection vault
│   │   └── cards/[id]/             # Card detail view
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Landing/redirect
├── components/
│   ├── auth/                       # Auth components
│   ├── cards/                      # Card components
│   ├── upload/                     # Upload components
│   ├── vault/                      # Vault components
│   └── ui/                         # shadcn/ui components
├── lib/
│   ├── api.ts                      # API client
│   ├── auth.ts                     # Auth helpers
│   └── utils.ts                    # Utilities
└── package.json
```

## Backend API Endpoints

### Authentication

- All requests require JWT in HTTP-only cookies (set by Cognito OAuth)

### Available Endpoints

| Method | Endpoint              | Purpose              | Idempotency Required |
| ------ | --------------------- | -------------------- | -------------------- |
| POST   | `/upload/presign`     | Get presigned S3 URL | No                   |
| POST   | `/cards`              | Create card record   | Yes                  |
| GET    | `/cards`              | List user's cards    | No                   |
| GET    | `/cards/{id}`         | Get card details     | No                   |
| DELETE | `/cards/{id}`         | Delete card          | No                   |
| POST   | `/cards/{id}/revalue` | Refresh valuation    | Yes                  |

## Shared Types (from @collectiq/shared)

```typescript
import {
  Card,
  CreateCardRequest,
  ListCardsResponse,
  PresignRequest,
  PresignResponse,
  RevalueRequest,
  RevalueResponse,
  ProblemDetails,
} from '@collectiq/shared';
```

### Key Types

**Card:**

```typescript
{
  cardId: string;                    // UUID
  userId: string;                    // Cognito sub
  name?: string;
  set?: string;
  number?: string;
  rarity?: string;
  conditionEstimate?: string;
  frontS3Key: string;
  backS3Key?: string;
  idConfidence?: number;             // 0-1
  authenticityScore?: number;        // 0-1 (undefined while processing)
  authenticitySignals?: {
    visualHashConfidence: number;
    textMatchConfidence: number;
    holoPatternConfidence: number;
    borderConsistency: number;
    fontValidation: number;
  };
  valueLow?: number;                 // USD (undefined while processing)
  valueMedian?: number;              // USD
  valueHigh?: number;                // USD
  compsCount?: number;
  sources?: string[];                // ['eBay', 'TCGPlayer', 'PriceCharting']
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
}
```

## API Client Implementation

### Basic Structure

```typescript
// apps/web/lib/api.ts
import { v4 as uuidv4 } from 'uuid';
import {
  Card,
  CardSchema,
  CreateCardRequest,
  CreateCardRequestSchema,
  ListCardsResponse,
  ListCardsResponseSchema,
  PresignRequest,
  PresignRequestSchema,
  PresignResponse,
  PresignResponseSchema,
  RevalueRequest,
  RevalueRequestSchema,
  RevalueResponse,
  RevalueResponseSchema,
  ProblemDetails,
  ProblemDetailsSchema,
} from '@collectiq/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    schema?: z.ZodSchema<T>,
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const problem = await response.json();
      throw new ApiError(problem);
    }

    const data = await response.json();
    return schema ? schema.parse(data) : data;
  }

  async getPresignedUrl(params: PresignRequest): Promise<PresignResponse> {
    return this.request(
      '/upload/presign',
      {
        method: 'POST',
        body: JSON.stringify(params),
      },
      PresignResponseSchema,
    );
  }

  async createCard(data: CreateCardRequest, idempotencyKey: string): Promise<Card> {
    return this.request(
      '/cards',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(data),
      },
      CardSchema,
    );
  }

  async getCards(params?: { cursor?: string; limit?: number }): Promise<ListCardsResponse> {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', params.limit.toString());

    return this.request(`/cards?${query}`, { method: 'GET' }, ListCardsResponseSchema);
  }

  async getCard(id: string): Promise<Card> {
    return this.request(`/cards/${id}`, { method: 'GET' }, CardSchema);
  }

  async deleteCard(id: string): Promise<void> {
    await this.request(`/cards/${id}`, { method: 'DELETE' });
  }

  async revalueCard(
    id: string,
    options: { forceRefresh?: boolean },
    idempotencyKey: string,
  ): Promise<RevalueResponse> {
    return this.request(
      `/cards/${id}/revalue`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(options),
      },
      RevalueResponseSchema,
    );
  }
}

export const api = new ApiClient();

export class ApiError extends Error {
  constructor(public problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ApiError';
  }
}
```

## Common Patterns

### 1. Upload Flow

```typescript
// apps/web/app/(protected)/upload/page.tsx
const handleUpload = async (file: File) => {
  try {
    // 1. Get presigned URL
    const presign = await api.getPresignedUrl({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    });

    // 2. Upload to S3
    await uploadToS3(presign.uploadUrl, file);

    // 3. Create card record
    const idempotencyKey = uuidv4();
    const card = await api.createCard({ frontS3Key: presign.key }, idempotencyKey);

    // 4. Redirect to card detail
    router.push(`/cards/${card.cardId}`);
  } catch (error) {
    handleError(error);
  }
};

const uploadToS3 = (url: string, file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      setProgress((e.loaded / e.total) * 100);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
};
```

### 2. Card Detail with Processing

```typescript
// apps/web/app/(protected)/cards/[id]/page.tsx
const CardDetailPage = ({ params }: { params: { id: string } }) => {
  const [card, setCard] = useState<Card | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadCard = async () => {
      const data = await api.getCard(params.id);
      setCard(data);

      // Check if analysis is complete
      if (!data.authenticityScore || !data.valueLow) {
        setIsProcessing(true);
        pollForAnalysis(params.id);
      }
    };

    loadCard();
  }, [params.id]);

  const pollForAnalysis = async (cardId: string) => {
    const maxAttempts = 60;
    const interval = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      await sleep(interval);

      const updated = await api.getCard(cardId);

      if (updated.authenticityScore && updated.valueLow) {
        setCard(updated);
        setIsProcessing(false);
        return;
      }
    }

    setIsProcessing(false);
    showError('Analysis timeout');
  };

  if (isProcessing) {
    return <CardProcessing />;
  }

  return (
    <div>
      <CardImage src={card.frontS3Key} />
      <AuthenticitySection
        score={card.authenticityScore}
        signals={card.authenticitySignals}
      />
      <ValuationSection
        low={card.valueLow}
        median={card.valueMedian}
        high={card.valueHigh}
        sources={card.sources}
        compsCount={card.compsCount}
      />
    </div>
  );
};
```

### 3. Vault with Pagination

```typescript
// apps/web/app/(protected)/vault/page.tsx
const VaultPage = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setIsLoading(true);
    const response = await api.getCards({ limit: 20 });
    setCards(response.items);
    setNextCursor(response.nextCursor);
    setIsLoading(false);
  };

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;

    setIsLoading(true);
    const response = await api.getCards({ cursor: nextCursor, limit: 20 });
    setCards(prev => [...prev, ...response.items]);
    setNextCursor(response.nextCursor);
    setIsLoading(false);
  };

  const totalValue = cards.reduce((sum, card) =>
    sum + (card.valueMedian || 0), 0
  );

  return (
    <div>
      <PortfolioSummary
        totalValue={totalValue}
        totalCards={cards.length}
      />
      <VaultGrid cards={cards} />
      {nextCursor && (
        <Button onClick={loadMore} disabled={isLoading}>
          Load More
        </Button>
      )}
    </div>
  );
};
```

### 4. Revaluation

```typescript
const handleRevalue = async (cardId: string) => {
  try {
    const idempotencyKey = uuidv4();
    const response = await api.revalueCard(cardId, { forceRefresh: true }, idempotencyKey);

    toast({
      title: 'Revaluation started',
      description: 'Checking for updated pricing...',
    });

    // Poll for updates
    const originalCard = await api.getCard(cardId);

    for (let i = 0; i < 30; i++) {
      await sleep(5000);

      const updated = await api.getCard(cardId);

      if (updated.updatedAt !== originalCard.updatedAt) {
        setCard(updated);
        toast({
          title: 'Valuation updated',
          description: 'Your card has been revalued.',
        });
        return;
      }
    }

    toast({
      variant: 'destructive',
      title: 'Timeout',
      description: 'Revaluation is taking longer than expected.',
    });
  } catch (error) {
    handleError(error);
  }
};
```

### 5. Optimistic Delete

```typescript
const handleDelete = async (cardId: string) => {
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
    // Rollback
    setCards(originalCards);
    handleError(error);
  }
};
```

## Error Handling

```typescript
const handleError = (error: unknown) => {
  if (error instanceof ApiError) {
    const { problem } = error;

    // Handle specific status codes
    switch (problem.status) {
      case 401:
        // Redirect to Cognito Hosted UI
        window.location.href = '/auth/signin';
        break;
      case 403:
        toast({
          variant: 'destructive',
          title: 'Access Denied',
          description: "You don't have access to this resource.",
        });
        break;
      case 404:
        toast({
          variant: 'destructive',
          title: 'Not Found',
          description: problem.detail,
        });
        break;
      case 413:
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: 'Maximum file size is 12MB.',
        });
        break;
      default:
        toast({
          variant: 'destructive',
          title: problem.title,
          description: problem.detail,
        });
    }
  } else {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'An unexpected error occurred.',
    });
  }
};
```

## Environment Variables

```bash
# .env.local
NEXT_PUBLIC_API_BASE=http://localhost:3001
NEXT_PUBLIC_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=xxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm web:dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm web:build

# Start production server
pnpm web:start
```

## Testing

```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Run accessibility tests
pnpm test:a11y

# Run all tests
pnpm test:all
```

## Key Considerations

### 1. Idempotency

- Always generate a new UUID for Idempotency-Key on POST operations
- Store the key to prevent duplicate submissions (e.g., double-click)

### 2. Polling

- Poll every 5 seconds for processing/revaluation
- Add timeout after 5 minutes
- Stop polling when data changes

### 3. Error Handling

- Parse ProblemDetails responses
- Display user-friendly messages
- Provide retry options

### 4. Loading States

- Show skeletons during initial load
- Show spinners during mutations
- Show progress bars during uploads

### 5. Optimistic Updates

- Update UI immediately for better UX
- Rollback on error
- Show toast notifications

## Next Steps

1. **Complete UI Layouts:** Build all pages with mock data
2. **Integrate Upload Flow:** Connect presign → S3 → create card
3. **Integrate Card Detail:** Display real analysis results with polling
4. **Integrate Vault:** Display real card collection with pagination
5. **Integrate Revaluation:** Enable refresh valuation with polling
6. **Polish & Test:** Add error handling, loading states, and tests

## Resources

- [Backend Integration Guide](./BACKEND_INTEGRATION.md)
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md)
- [Requirements](./requirements.md)
- [Design](./design.md)
- [Tasks](./tasks.md)
- [Shared Types Package](../../../packages/shared/)
- [Next.js Documentation](https://nextjs.org/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
