# Design Document

## Overview

The CollectIQ frontend is a modern, authentication-first web application built with Next.js 14 (App Router), React 18, and TypeScript. It provides collectors with a seamless experience for scanning, identifying, authenticating, and valuating Pokémon Trading Card Game cards through real-time AI-powered analysis.

The frontend is part of a pnpm workspace monorepo, located in `apps/web/` with components organized by feature domain. It leverages shared packages from `packages/shared/` (TypeScript types and Zod schemas shared with the backend), `packages/config/` (build and lint configuration), and `packages/telemetry/` (logging utilities). This ensures type consistency between frontend and backend while maintaining clear separation of concerns.

The application follows a progressive workflow architecture where each screen builds upon the previous step: authentication → upload → identification → authenticity analysis → valuation → vault storage → collection management. The design emphasizes immediate feedback, clear visual hierarchy, and accessible interactions across desktop and mobile devices.

Key design principles:

- **Authentication-first**: All user data is scoped and protected via Amazon Cognito JWT tokens using Hosted UI
- **Real-time feedback**: Progressive loading states and optimistic UI updates
- **Accessibility**: WCAG 2.2 AA compliance with keyboard-first navigation
- **Performance**: Core Web Vitals targets (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- **Mobile-optimized**: Native camera integration and touch-friendly interfaces
- **Secure by default**: HTTP-only cookies, strict CSP, no client-side token storage

**Authentication Approach**: The application uses Amazon Cognito's Hosted UI for all authentication flows (sign in, sign up, password reset, email verification). This approach provides:

- Production-ready, secure authentication UI maintained by AWS
- Built-in support for MFA, social sign-in, and custom branding
- Reduced frontend complexity (no custom auth forms to build/maintain)
- OAuth 2.0 with PKCE for enhanced security
- Automatic handling of edge cases (rate limiting, account lockout, etc.)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 14 App Router                    │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   Public   │  │ Protected  │  │    API     │           │
│  │   Routes   │  │   Routes   │  │  Routes    │           │
│  │            │  │            │  │            │           │
│  │  /auth     │  │  /upload   │  │  /api/*    │           │
│  │            │  │  /vault    │  │            │           │
│  │            │  │  /cards/:id│  │            │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Cognito    │    │  API Gateway │    │      S3      │
│     Auth     │    │   + Lambda   │    │   Storage    │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Monorepo Integration

The frontend is part of a pnpm workspace monorepo and integrates with shared packages:

**Workspace Structure:**

```
collect-iq/
├── apps/
│   └── web/                      # Frontend application (this spec)
├── services/
│   └── backend/                  # Backend Lambda functions
├── packages/
│   ├── shared/                   # Shared types and Zod schemas
│   ├── config/                   # Shared build/lint config
│   └── telemetry/                # Logging utilities
└── infra/
    └── terraform/                # Infrastructure as code
```

**Package Dependencies:**

The frontend (`apps/web/package.json`) depends on:

- `@collectiq/shared`: For shared TypeScript types and Zod schemas
- `@collectiq/config`: For ESLint and TypeScript configuration (optional)
- `@collectiq/telemetry`: For logging utilities (optional)

This ensures type consistency between frontend and backend while maintaining clear separation of concerns.

### Folder Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Public route group
│   │   └── auth/                 # Authentication routes
│   │       └── callback/         # OAuth callback handler
│   ├── (protected)/              # Protected route group
│   │   ├── upload/               # Card upload flow
│   │   ├── vault/                # Collection vault
│   │   └── cards/[id]/           # Card detail view
│   ├── api/                      # API route handlers (if needed)
│   ├── layout.tsx                # Root layout with providers
│   ├── page.tsx                  # Landing/redirect page
│   └── globals.css               # Global styles and tokens
├── components/
│   ├── auth/                     # Authentication components
│   │   ├── AuthGuard.tsx         # Route protection wrapper
│   │   └── SessionExpiredModal.tsx
│   ├── cards/                    # Card-related components
│   │   ├── AuthenticityBadge.tsx
│   │   ├── CardGrid.tsx
│   │   ├── CardDetail.tsx
│   │   ├── ValuationPanel.tsx
│   │   └── CandidateList.tsx
│   ├── upload/                   # Upload components
│   │   ├── UploadDropzone.tsx
│   │   ├── CameraCapture.tsx
│   │   └── UploadProgress.tsx
│   ├── vault/                    # Vault components
│   │   ├── VaultGrid.tsx
│   │   ├── PortfolioSummary.tsx
│   │   └── VaultFilters.tsx
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── toast.tsx
│       └── ...
├── lib/
│   ├── api.ts                    # Typed API client
│   ├── auth.ts                   # Cognito helpers
│   ├── format.ts                 # Formatting utilities
│   ├── guards.tsx                # Auth guards and HOCs
│   └── utils.ts                  # General utilities
├── styles/                       # Additional styles
└── tests/
    ├── unit/                     # Unit tests
    ├── integration/              # Integration tests
    └── e2e/                      # Playwright E2E tests
```

**Shared Packages (Monorepo):**

The frontend imports shared code from the monorepo's `packages/` directory:

- `packages/shared/`: TypeScript types and Zod schemas shared between frontend and backend
  - Card types, ValuationData, AuthenticityDetails, ProblemDetails
  - Ensures type consistency across the application
  - Imported as `@collectiq/shared` in the frontend
- `packages/config/`: Shared ESLint, Prettier, and TypeScript configuration
- `packages/telemetry/`: Logging utilities that can be used in both frontend and backend

### Technology Stack

**Core Framework**

- Next.js 14 with App Router for file-based routing and server components
- React 18 for UI rendering with hooks and concurrent features
- TypeScript (non-strict mode) for type safety

**Styling & UI**

- Tailwind CSS v4 with @theme directive for design tokens
- shadcn/ui components built on Radix UI primitives
- CSS variables for theme switching (light/dark mode)

**Authentication**

- Amazon Cognito Hosted UI for sign in/sign up/password reset
- OAuth 2.0 authorization code flow with PKCE
- JWT tokens stored in secure HTTP-only cookies
- Session management with automatic refresh

**Data Fetching & State**

- SWR for client-side data fetching and caching
- Zod for runtime schema validation
- Native fetch API with typed wrapper

**Charts & Visualization**

- Recharts (lazy-loaded) for valuation history charts
- Custom SVG components for sparklines

**Testing**

- Vitest + React Testing Library for unit/integration tests
- Playwright for end-to-end testing
- axe-core for accessibility testing

**Tooling**

- ESLint with next/core-web-vitals config
- Prettier for code formatting
- Husky + lint-staged for pre-commit hooks

## Components and Interfaces

### Core Component Architecture

#### 1. Authentication Components

**AuthGuard**

```typescript
interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Wraps protected routes, handles session verification
// Shows loading spinner while checking auth status
// Redirects to Cognito Hosted UI if unauthenticated
// Preserves intended destination in state parameter
```

**SessionExpiredModal**

```typescript
interface SessionExpiredModalProps {
  isOpen: boolean;
  onReauthenticate: () => void;
  onSignOut: () => void;
}

// Displays when JWT expires
// Re-authenticate redirects to Cognito Hosted UI
// Preserves user context for replay after re-auth
```

**OAuth Callback Handler**

```typescript
interface OAuthCallbackProps {
  code: string;
  state: string;
}

// Handles OAuth callback from Cognito Hosted UI at /auth/callback
// Exchanges authorization code for tokens via backend API
// Validates state parameter for CSRF protection
// Redirects to intended destination after successful auth
```

#### 2. Upload Components

**UploadDropzone**

```typescript
interface UploadDropzoneProps {
  accept: string[]; // ['image/jpeg', 'image/png', 'image/heic', 'image/heif']
  maxSizeMB: number; // 12
  onSelected: (files: File[]) => void;
  onError: (error: UploadError) => void;
}

// Drag-and-drop area with file validation
// Mobile: triggers file picker or camera
// States: idle, hover, uploading, error
```

**CameraCapture**

```typescript
interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  onError: (error: CameraError) => void;
  onClose: () => void;
}

// Uses getUserMedia API for camera access
// Handles permissions and orientation
// iOS Safari compatibility layer
```

**UploadProgress**

```typescript
interface UploadProgressProps {
  progress: number; // 0-100
  fileName: string;
  thumbnail?: string;
  onCancel: () => void;
}

// Progress bar with thumbnail preview
// Cancel button aborts upload
```

#### 3. Card Identification Components

**CandidateList**

```typescript
interface Candidate {
  id: string;
  name: string;
  set: string;
  rarity: string;
  confidence: number; // 0-1
  imageUrl?: string;
}

interface CandidateListProps {
  candidates: Candidate[];
  onSelect: (candidate: Candidate) => void;
}

// Displays top-k identification results
// Confidence bars and card metadata
```

#### 4. Authenticity Components

**AuthenticityBadge**

```typescript
interface AuthenticityBadgeProps {
  score: number; // 0-1
  rationale?: string;
  breakdown?: {
    visualHashConfidence: number;
    textMatchConfidence: number;
    holoPatternConfidence: number;
  };
}

// Rounded pill with color-coded score
// Tooltip shows detailed breakdown
// Warning indicator for low scores
```

#### 5. Valuation Components

**ValuationPanel**

```typescript
interface ValuationData {
  low: number;
  median: number;
  high: number;
  trend: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  confidence: number;
  compsCount: number;
  windowDays: number;
  sources: Array<{
    name: string;
    logo: string;
  }>;
  lastUpdated: string;
}

interface ValuationPanelProps {
  value: ValuationData;
  onRefresh?: () => void;
  onSave?: () => void;
}

// Displays price range and trend
// Source attribution with logos
// Confidence indicator
```

#### 6. Vault Components

**VaultGrid**

```typescript
interface VaultCard {
  id: string;
  name: string;
  set: string;
  rarity: string;
  imageUrl: string;
  currentValue: number;
  authenticityScore: number;
  dateAdded: string;
}

interface VaultGridProps {
  cards: VaultCard[];
  filters: VaultFilters;
  sortBy: 'value' | 'date' | 'rarity';
  onCardClick: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
}

// Grid layout with responsive columns
// Quick actions on hover/long-press
// Virtualization for large collections
```

**PortfolioSummary**

```typescript
interface PortfolioSummaryProps {
  totalValue: number;
  totalCards: number;
  change: {
    value: number;
    percentage: number;
  };
  sparklineData: Array<{ date: string; value: number }>;
}

// Summary card at top of vault
// 14-day performance sparkline
// Total value and card count
```

#### 7. Card Detail Components

**CardDetail**

```typescript
interface CardDetailProps {
  card: {
    id: string;
    name: string;
    set: string;
    rarity: string;
    imageUrl: string;
    authenticityScore: number;
    currentValuation: ValuationData;
    valuationHistory: Array<{
      date: string;
      low: number;
      median: number;
      high: number;
    }>;
  };
  onReEvaluate: () => void;
  onDelete: () => void;
  onShare: () => void;
}

// Large zoomable image
// Valuation history chart (Recharts)
// Action buttons
```

### API Client Interface

**lib/api.ts**

```typescript
interface ApiClient {
  // Upload - POST /upload/presign
  getPresignedUrl(params: {
    filename: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<PresignResponse>; // { uploadUrl, key, expiresIn }

  // Cards - POST /cards (with Idempotency-Key header)
  createCard(data: CreateCardRequest, idempotencyKey: string): Promise<Card>;

  // Cards - GET /cards?cursor={cursor}&limit={limit}
  getCards(params?: { cursor?: string; limit?: number }): Promise<ListCardsResponse>; // { items: Card[], nextCursor?: string }

  // Cards - GET /cards/{id}
  getCard(id: string): Promise<Card>;

  // Cards - DELETE /cards/{id}
  deleteCard(id: string): Promise<void>; // 204 No Content

  // Cards - POST /cards/{id}/revalue (with Idempotency-Key header)
  revalueCard(
    id: string,
    options: { forceRefresh?: boolean },
    idempotencyKey: string
  ): Promise<RevalueResponse>; // { executionArn, status: 'RUNNING', message }
}

// Centralized API client with:
// - Automatic credential inclusion (cookies)
// - Zod validation using @collectiq/shared schemas
// - ProblemDetails error handling
// - Exponential backoff for retries
// - Idempotency-Key header generation for POST operations
```

## Data Models

### Frontend Data Types

**User Session**

```typescript
interface UserSession {
  sub: string; // Cognito user ID
  email: string;
  emailVerified: boolean;
  accessToken: string; // JWT (stored in HTTP-only cookie)
  refreshToken: string; // Stored in HTTP-only cookie
  expiresAt: number; // Unix timestamp
}
```

**Card**

```typescript
interface Card {
  cardId: string;
  userId: string;
  detectedName: string;
  set: string;
  rarity: string;
  conditionEstimate: string;
  holoType?: string;
  imageS3KeyFront: string;
  imageS3KeyBack?: string;
  valueEstimate: ValuationData;
  authenticityScore: number;
  authenticityDetails: {
    visualHashConfidence: number;
    textMatchConfidence: number;
    holoPatternConfidence: number;
    rationale: string;
    fakeDetected: boolean;
  };
  createdAt: string;
  updatedAt: string;
}
```

**ProblemDetails (RFC 7807)**

```typescript
interface ProblemDetails {
  type: string; // URI reference
  title: string; // Short summary
  status: number; // HTTP status code
  detail: string; // Human-readable explanation
  instance?: string; // URI reference to specific occurrence
  requestId?: string; // For traceability
}
```

### Zod Schemas

All API responses are validated using Zod schemas imported from the shared package. These schemas are defined once in `packages/shared/` and used by both frontend and backend to ensure type consistency:

```typescript
// Frontend usage
import {
  ValuationDataSchema,
  CardSchema,
  ProblemDetailsSchema,
  type Card,
  type ValuationData,
  type ProblemDetails,
} from '@collectiq/shared';

// Validate API response
const card = CardSchema.parse(apiResponse);

// Use TypeScript types
const handleCard = (card: Card) => {
  // Type-safe card handling
};
```

**Shared Schema Examples** (defined in `packages/shared/src/schemas.ts`):

```typescript
// packages/shared/src/schemas.ts
import { z } from 'zod';

export const ValuationDataSchema = z.object({
  low: z.number(),
  median: z.number(),
  high: z.number(),
  trend: z.object({
    direction: z.enum(['up', 'down', 'stable']),
    percentage: z.number(),
  }),
  confidence: z.number().min(0).max(1),
  compsCount: z.number(),
  windowDays: z.number(),
  sources: z.array(
    z.object({
      name: z.string(),
      logo: z.string(),
    })
  ),
  lastUpdated: z.string(),
});

export const CardSchema = z.object({
  cardId: z.string(),
  userId: z.string(),
  detectedName: z.string(),
  set: z.string(),
  rarity: z.string(),
  // ... rest of fields
});

// Export TypeScript types
export type ValuationData = z.infer<typeof ValuationDataSchema>;
export type Card = z.infer<typeof CardSchema>;
```

## Error Handling

### Error Handling Strategy

All errors follow RFC 7807 ProblemDetails format. The API client parses errors and converts them to typed exceptions that components can handle gracefully.

**Error Flow**

```
API Error → Parse ProblemDetails → Map to User Message → Display with Remediation
```

**Common Error Mappings**

| Status | Type                  | User Message                       | Remediation             |
| ------ | --------------------- | ---------------------------------- | ----------------------- |
| 401    | Unauthorized          | Your session expired               | Re-authenticate button  |
| 403    | Forbidden             | You don't have access to this card | Return to vault         |
| 413    | Payload Too Large     | Image too large (max 12 MB)        | Choose smaller file     |
| 415    | Unsupported Media     | Unsupported file type              | Use JPG, PNG, or HEIC   |
| 429    | Too Many Requests     | Rate limit exceeded                | Countdown timer + retry |
| 500    | Internal Server Error | Something went wrong               | Retry with backoff      |

**Error Component**

```typescript
interface ErrorAlertProps {
  problem: ProblemDetails;
  onRetry?: () => void;
  onDismiss?: () => void;
}

// Displays user-friendly error message
// Shows remediation action
// Includes retry button when applicable
```

### Retry Logic

- GET requests: automatic retry with exponential backoff (3 attempts)
- POST/DELETE: no automatic retry unless explicitly enabled
- Backoff: 1s, 2s, 4s
- User-initiated retry always available

## Testing Strategy

### Unit Tests (Vitest)

**Coverage Areas**

- Utility functions (formatters, validators)
- Zod schema parsing
- API client methods
- Component logic (hooks, state management)
- Auth guards and route protection

**Example Test**

```typescript
describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(123.45)).toBe('$123.45');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });
});
```

### Integration Tests

**Coverage Areas**

- Upload flow: presign → PUT → finalize
- Vault pagination and filtering
- Error state handling
- Optimistic UI updates with rollback

**Example Test**

```typescript
describe('Upload Flow', () => {
  it('completes full upload cycle', async () => {
    // Mock presign API
    // Simulate file selection
    // Verify progress updates
    // Confirm redirect to identify screen
  });
});
```

### E2E Tests (Playwright)

**Critical Paths**

1. Auth redirect for unauthenticated users
2. Happy path: upload → identify → valuation → save
3. Session expiry and re-authentication
4. Vault filtering and card detail navigation
5. Safari browser compatibility

**Example Test**

```typescript
test('complete card upload flow', async ({ page }) => {
  await page.goto('/upload');
  await page.setInputFiles('input[type="file"]', 'test-card.jpg');
  await expect(page.locator('[data-testid="progress"]')).toBeVisible();
  await expect(page).toHaveURL(/\/identify/);
  // ... continue flow
});
```

### Accessibility Tests

**Tools**

- axe-core for automated WCAG checks
- Manual keyboard navigation testing
- Screen reader testing (VoiceOver, NVDA)

**Coverage**

- Focus management in modals
- Keyboard navigation in grids
- ARIA live regions for async updates
- Color contrast ratios
- Alt text for images

### Performance Tests

**Lighthouse CI**

- Thresholds: LCP < 2.5s, CLS < 0.1, INP < 200ms
- Run on every PR
- Block merge if thresholds not met

**Custom Performance Metrics**

- Time to interactive for upload screen
- Vault grid render time
- Chart load time

## Design System Implementation

### Color Tokens

**Primary Colors**

- `--color-vault-blue`: #1A73E8 (primary actions)
- `--color-holo-cyan`: #00C6FF (secondary accent)

**Surface Colors**

- `--color-carbon-gray`: #1E1E1E (dark mode background)
- `--color-cloud-silver`: #F5F7FA (light mode background)
- `--color-graphite-gray`: #2E2E2E (dark mode cards)

**Semantic Colors**

- `--color-emerald-glow`: #00E676 (success)
- `--color-amber-pulse`: #FFC400 (warning)
- `--color-crimson-red`: #D32F2F (error)

### Typography

**Font Families**

- Sans: Inter (UI elements)
- Display: Space Grotesk (headings)
- Mono: JetBrains Mono (code/data)

**Font Weights**

- Regular (400): body text
- Medium (500): emphasis
- Bold (700): headings

### Spacing System

Based on 8px grid:

- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px

### Component Styling

**Button Variants**

- primary: Vault Blue background
- secondary: Holo Cyan background
- gradient: Blue to Cyan gradient
- outline: transparent with border
- ghost: transparent background

**Border Radius**

- Cards: 12-16px
- Buttons: 8-12px
- Inputs: 8px
- Badges: 9999px (pill)

**Shadows**

- sm: subtle elevation
- md: standard cards
- lg: modals and dialogs

### Motion & Animation

**Transition Durations**

- Fast: 150ms (hover states)
- Base: 200-250ms (standard transitions)
- Slow: 300ms (complex animations)

**Easing**

- ease-in-out for most transitions
- ease-out for entrances
- ease-in for exits

**Reduced Motion**

- Respect prefers-reduced-motion
- Disable animations
- Use instant transitions

## Security Considerations

### Authentication Security

**OAuth 2.0 Flow with Cognito Hosted UI**

The application uses Amazon Cognito's Hosted UI with OAuth 2.0 authorization code flow with PKCE (Proof Key for Code Exchange):

1. **Initiate Authentication**: User clicks sign in → redirect to Cognito Hosted UI
   - Generate code verifier (random string)
   - Generate code challenge (SHA256 hash of verifier)
   - Build authorization URL with state parameter (contains intended destination)
   - Redirect to: `https://{domain}/oauth2/authorize?response_type=code&client_id={id}&redirect_uri={uri}&state={state}&code_challenge={challenge}&code_challenge_method=S256`

2. **User Authenticates**: User signs in/signs up via Hosted UI
   - Cognito handles all UI, validation, and security
   - Supports email verification, password reset, MFA
   - No custom authentication forms needed

3. **OAuth Callback**: Cognito redirects to `/auth/callback?code={code}&state={state}`
   - Validate state parameter matches original request (CSRF protection)
   - Exchange authorization code for tokens via backend API
   - Backend validates code with code verifier
   - Receive access token, ID token, refresh token

4. **Store Tokens**: Backend sets HTTP-only cookies
   - Access token (1 hour expiry)
   - Refresh token (30 days expiry)
   - ID token (user info)

5. **Redirect**: Navigate to intended destination from state parameter

**Token Storage**

- JWT stored in HTTP-only cookies
- SameSite=Lax to prevent CSRF
- Secure flag in production
- Never store tokens in localStorage or sessionStorage

**Session Management**

- Short-lived access tokens (1 hour)
- Automatic silent refresh using refresh token
- Session expiry modal preserves context and redirects to Hosted UI
- Logout calls Cognito logout endpoint and clears all cookies

### Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.collectiq.com https://*.amazoncognito.com;
  frame-ancestors 'none';
  form-action 'self' https://*.amazoncognito.com;
```

Note: The CSP allows connections to Cognito domains for OAuth redirects and token exchange.

### Input Validation

- Client-side validation mirrors backend Zod schemas
- File type validation before upload
- File size validation (12 MB limit)
- Sanitize user input in forms
- Server remains source of truth

### Privacy

- No PII in logs or analytics
- Respect Do Not Track (DNT)
- GDPR-compliant data handling
- User can delete all data

## Performance Optimization

### Code Splitting

- Route-based splitting (automatic with Next.js)
- Lazy load Recharts library
- Dynamic imports for heavy components

### Image Optimization

- Next.js Image component with automatic optimization
- Blur placeholders for smooth loading
- Responsive images with srcset
- WebP format with fallbacks

### Caching Strategy

**SWR Configuration**

```typescript
{
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  focusThrottleInterval: 5000,
}
```

**Cache Keys**

- User-scoped: `user:${userId}:cards`
- Card-specific: `card:${cardId}`
- Invalidate on mutations

### Bundle Optimization

- Tree-shaking unused code
- Minimize third-party dependencies
- Use native browser APIs when possible
- Analyze bundle with @next/bundle-analyzer

## Deployment Architecture

### Build Process

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test

# Build
pnpm build

# Start production server
pnpm start
```

### Environment Variables

**Required**

- `NEXT_PUBLIC_REGION`: AWS region
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`: Cognito user pool ID
- `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`: Cognito app client ID
- `NEXT_PUBLIC_COGNITO_DOMAIN`: Cognito Hosted UI domain (e.g., collectiq.auth.us-east-1.amazoncognito.com)
- `NEXT_PUBLIC_OAUTH_REDIRECT_URI`: OAuth callback URL (e.g., https://app.collectiq.com/auth/callback)
- `NEXT_PUBLIC_OAUTH_LOGOUT_URI`: Post-logout redirect URL (e.g., https://app.collectiq.com)
- `NEXT_PUBLIC_API_BASE`: API base URL

**Optional**

- `FEATURE_FLAGS`: Comma-separated feature flags
- `SENTRY_DSN`: Error tracking
- `NEXT_PUBLIC_ANALYTICS_ID`: Analytics tracking

### Hosting

**Recommended: AWS Amplify**

- Automatic deployments from Git
- Preview environments for PRs
- Custom domain with SSL
- CDN distribution
- Environment variable management

**Alternative: Vercel**

- Zero-config Next.js deployment
- Edge network
- Preview deployments
- Analytics built-in

## Future Enhancements

### Phase 2 Features

1. **Offline Support**
   - Service worker for offline caching
   - Queue uploads for when online
   - Cached vault view

2. **Advanced Filtering**
   - Multi-select filters
   - Saved filter presets
   - Advanced search with fuzzy matching

3. **Bulk Operations**
   - Multi-select cards
   - Bulk valuation refresh
   - Bulk export to CSV

4. **Social Features**
   - Share collection publicly
   - Compare collections with friends
   - Trading marketplace integration

5. **Mobile App**
   - React Native version
   - Native camera integration
   - Push notifications for price alerts

### Technical Debt

- Migrate to TypeScript strict mode
- Implement Storybook for component documentation
- Add visual regression testing
- Optimize bundle size further
- Implement server-side rendering for SEO

## Conclusion

This design provides a comprehensive blueprint for building the CollectIQ frontend. It balances modern web development practices with practical considerations for performance, accessibility, and security. The architecture is modular and extensible, allowing for future enhancements while maintaining a solid foundation.

Key design decisions:

- Next.js App Router for modern routing and server components
- Authentication-first architecture with Cognito
- Component-driven development with shadcn/ui
- Type-safe API client with Zod validation
- Comprehensive error handling with ProblemDetails
- Performance-focused with Core Web Vitals targets
- Accessibility-first with WCAG 2.2 AA compliance
