# CollectIQ Web Application

**Enterprise-grade frontend for AI-powered trading card intelligence — real-time valuation, authenticity detection, and secure portfolio management**

---

## Overview

The CollectIQ web application is the user-facing interface for the CollectIQ platform, delivering a seamless experience for Pokémon TCG collectors to upload, authenticate, value, and manage their card collections. Built with Next.js 14 and deployed on AWS Amplify, the frontend connects to a serverless multi-agent AI backend orchestrated through AWS Step Functions, Amazon Bedrock, and Amazon Rekognition.

### The User Experience

CollectIQ transforms the collector workflow from manual research and uncertainty into instant, AI-powered intelligence:

1. **Instant Upload** — Capture card images via camera or file upload with real-time validation
2. **AI Processing** — Multi-agent pipeline extracts features, computes valuation, and verifies authenticity
3. **Explainable Results** — View confidence-scored pricing and authenticity with human-readable rationale
4. **Secure Vault** — Manage your collection with time-series pricing data and portfolio analytics
5. **Mobile-First Design** — Responsive UI optimized for iOS and Android with pull-to-refresh and bottom sheets

### Market Context

The $400+ billion collectibles market lacks accessible, trustworthy tools for authentication and valuation. CollectIQ addresses this gap by bringing enterprise-grade AI to casual collectors through an intuitive, mobile-first interface that connects to AWS-native infrastructure for scalability and reliability.

---

## Architecture

### Frontend-Backend Integration

The web application implements an authentication-first, event-driven architecture that seamlessly integrates with the CollectIQ serverless backend:

```
┌─────────────────────────────────────────────────────────────┐
│                    CollectIQ Web App                        │
│                  (Next.js 14 + App Router)                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Landing    │  │     Auth     │  │   Protected  │    │
│  │   (Public)   │  │   Callback   │  │    Routes    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  Protected Routes:                                          │
│  • /upload    — Camera capture + file upload               │
│  • /vault     — Portfolio management + analytics           │
│  • /cards/:id — Detailed valuation + authenticity          │
│  • /identify  — Quick card lookup                          │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS + JWT (Cognito)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Amazon API Gateway (HTTP API)                     │
│              JWT Authorizer (Cognito)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Lambda:    │  │   Lambda:    │  │   Lambda:    │
│upload_presign│  │ cards_create │  │  cards_list  │
│              │  │              │  │              │
│ S3 presigned │  │ Step Functions│  │  DynamoDB   │
│     URLs     │  │   trigger    │  │   queries   │
└──────────────┘  └──────┬───────┘  └──────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │   AWS Step Functions Workflow          │
        │                                        │
        │  1. Rekognition Extract (features)     │
        │  2. OCR Reasoning Agent (Bedrock)      │
        │  3. Parallel: Pricing + Authenticity   │
        │  4. Aggregator (merge + persist)       │
        └────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────┐              ┌──────────────┐
│   DynamoDB   │              │  EventBridge │
│ (single-table)│              │   (events)   │
└──────────────┘              └──────────────┘
```

### Authentication Flow

CollectIQ implements OAuth 2.0 with PKCE via Amazon Cognito Hosted UI for secure, standards-compliant authentication:

1. User clicks "Sign In" → Redirects to Cognito Hosted UI
2. User authenticates (email/password or social providers)
3. Cognito redirects to `/auth/callback` with authorization code
4. Frontend exchanges code for JWT tokens (access, ID, refresh)
5. Tokens stored in HTTP-only cookies (never localStorage)
6. API Gateway validates JWT on every request
7. Lambda handlers extract `sub` (user ID) for data isolation

### Data Flow

**Upload Flow**:

1. User selects image → Frontend validates file type, size, dimensions
2. Frontend requests presigned S3 URL from `/api/upload/presign`
3. Frontend uploads image directly to S3 (bypasses API Gateway)
4. Frontend calls `/api/cards` with S3 key → Lambda triggers Step Functions
5. Step Functions orchestrates multi-agent pipeline (Rekognition → Bedrock)
6. Results persisted to DynamoDB with user-scoped partition key
7. Frontend polls `/api/cards/:id` for completion (SWR auto-refresh)

**Vault Flow**:

1. User navigates to `/vault` → Frontend fetches cards via `/api/cards`
2. Lambda queries DynamoDB with `PK: USER#{sub}` for data isolation
3. Frontend displays cards with filters (set, rarity, condition)
4. User clicks card → Navigate to `/cards/:id` for detailed view
5. Frontend fetches valuation + authenticity data with time-series pricing

---

## Key Features

### Real-Time Upload & Processing

- **Camera Capture**: Native camera integration with real-time preview
- **File Upload**: Drag-and-drop with instant validation (JPEG, PNG, HEIC)
- **Progress Tracking**: Visual feedback during S3 upload and AI processing
- **Error Handling**: Graceful degradation with retry logic and user-friendly messages

### Explainable AI Results

- **Valuation Panel**: Multi-source pricing (eBay, TCGPlayer, PriceCharting) with confidence scores
- **Authenticity Badge**: Visual indicator (Authentic, Suspicious, Fake) with detailed rationale
- **AI Insights**: Human-readable explanations for pricing and authenticity decisions
- **Market Data**: Comparable sales, price trends, and historical valuation charts

### Secure Portfolio Management

- **User-Scoped Vault**: JWT-authenticated access to personal collection
- **Portfolio Analytics**: Total value, set completion, rarity distribution
- **Time-Series Pricing**: Track card value over time with interactive charts
- **Filters & Search**: Filter by set, rarity, condition, authenticity status

### Mobile-First Design

- **Responsive Layout**: Optimized for iOS and Android with touch-friendly controls
- **Pull-to-Refresh**: Native-like gesture for refreshing vault data
- **Bottom Sheets**: Modal overlays for filters and actions
- **Dark Mode**: System-aware theme with manual toggle
- **Accessibility**: WCAG 2.1 AA compliant with keyboard navigation and ARIA labels

---

## Technology Stack

### Frontend Framework

- **Next.js 14**: App Router with React Server Components for optimal performance
- **React 18**: Concurrent rendering, Suspense, and automatic batching
- **TypeScript**: Non-strict mode for rapid development with type safety

### Styling & UI

- **Tailwind CSS v4**: Utility-first CSS with `@theme` directive for design tokens
- **shadcn/ui**: Accessible component library built on Radix UI primitives
- **Recharts**: Lazy-loaded charting library for valuation history
- **Lucide Icons**: Consistent iconography with tree-shaking

### Data Management

- **SWR**: Client-side caching with automatic revalidation and optimistic updates
- **Zod**: Runtime schema validation for API responses and form inputs
- **React Hook Form**: Performant form handling with validation

### Authentication & Security

- **Amazon Cognito**: OAuth 2.0 + PKCE with Hosted UI
- **JWT Validation**: API Gateway authorizer validates tokens on every request
- **HTTP-Only Cookies**: Secure token storage (never localStorage)
- **CORS**: Strict origin validation with preflight caching

### Performance & Monitoring

- **Image Optimization**: Next.js Image component with automatic WebP conversion
- **Code Splitting**: Route-based and component-level lazy loading
- **Web Vitals**: LCP < 2.5s, CLS < 0.1, INP < 200ms
- **Error Boundaries**: Graceful error handling with fallback UI
- **Structured Logging**: Request tracing with correlation IDs

### Testing & Quality

- **Vitest**: Fast unit testing with React Testing Library
- **Playwright**: End-to-end testing with cross-browser support
- **axe-core**: Automated accessibility testing
- **ESLint v9**: Flat config with TypeScript and React rules
- **Prettier**: Consistent code formatting

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- AWS account with Cognito User Pool configured
- Backend infrastructure deployed (see root README)

### Installation

```bash
# Navigate to web app directory
cd apps/web

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local
```

### Environment Configuration

Create `.env.local` with the following variables (validated in `lib/env.ts`):

```bash
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-1

# Cognito Authentication
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_COGNITO_DOMAIN=collectiq-hackathon.auth.us-east-1.amazoncognito.com

# OAuth Redirects
NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000

# API Gateway
NEXT_PUBLIC_API_BASE=https://api.collectiq.example.com
```

See [Environment Setup](./docs/getting-started/ENVIRONMENT_SETUP.md) for detailed configuration instructions.

### Development

```bash
# Start development server
pnpm dev

# Open browser
open http://localhost:3000
```

The app runs with hot module replacement and fast refresh enabled.

### Production Build

```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Preview at http://localhost:3000
```

### Code Quality

```bash
# Run linting
pnpm lint

# Type-check codebase
pnpm typecheck

# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

---

## Project Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (public)/                 # Unauthenticated routes
│   │   ├── landing/              # Marketing landing page
│   │   └── auth/                 # OAuth callback handler
│   ├── (protected)/              # JWT-protected routes
│   │   ├── upload/               # Card upload interface
│   │   ├── vault/                # Portfolio management
│   │   ├── cards/[id]/           # Card detail view
│   │   ├── identify/             # Quick card lookup
│   │   └── authenticity/         # Authenticity verification
│   ├── layout.tsx                # Root layout with providers
│   ├── page.tsx                  # Home page (redirects to /landing or /vault)
│   └── globals.css               # Global styles + Tailwind imports
│
├── components/                   # React components
│   ├── auth/                     # Authentication components
│   │   ├── AuthGuard.tsx         # Protected route wrapper
│   │   ├── SignInButton.tsx      # Cognito Hosted UI redirect
│   │   ├── SignOutButton.tsx     # Token revocation + logout
│   │   └── SessionExpiredModal.tsx
│   ├── cards/                    # Card-related components
│   │   ├── CardDetail.tsx        # Full card view with tabs
│   │   ├── CardProcessing.tsx    # Loading state during AI processing
│   │   ├── ValuationPanel.tsx    # Pricing data with confidence scores
│   │   ├── AuthenticityBadge.tsx # Visual authenticity indicator
│   │   ├── AIInsights.tsx        # Explainable AI rationale
│   │   ├── MarketDataTable.tsx   # Comparable sales data
│   │   ├── ValuationHistoryChart.tsx # Time-series pricing chart
│   │   ├── CandidateList.tsx     # OCR candidate selection
│   │   └── FeedbackModal.tsx     # User feedback collection
│   ├── upload/                   # Upload components
│   │   ├── UploadDropzone.tsx    # Drag-and-drop file upload
│   │   ├── CameraCapture.tsx     # Native camera integration
│   │   └── UploadProgress.tsx    # S3 upload progress indicator
│   ├── vault/                    # Vault components
│   │   ├── VaultGrid.tsx         # Card grid with infinite scroll
│   │   ├── VaultCard.tsx         # Card thumbnail with quick actions
│   │   ├── VaultFilters.tsx      # Filter by set, rarity, condition
│   │   ├── PortfolioSummary.tsx  # Total value + analytics
│   │   └── EmptyVault.tsx        # Empty state with CTA
│   ├── navigation/               # Navigation components
│   │   ├── Header.tsx            # Top navigation with user menu
│   │   └── Sidebar.tsx           # Desktop sidebar navigation
│   ├── providers/                # React context providers
│   │   ├── amplify-provider.tsx  # Amplify configuration
│   │   └── swr-provider.tsx      # SWR global config
│   └── ui/                       # shadcn/ui primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── table.tsx
│       ├── toast.tsx
│       ├── bottom-sheet.tsx      # Mobile modal overlay
│       ├── pull-to-refresh.tsx   # Native-like gesture
│       └── error-states.tsx      # Error UI components
│
├── hooks/                        # Custom React hooks
│   ├── use-card-image.ts         # S3 presigned URL fetching
│   ├── use-error-handler.ts      # Global error handling
│   ├── use-pull-to-refresh.ts    # Pull-to-refresh gesture
│   └── use-toast.ts              # Toast notification hook
│
├── lib/                          # Utilities and helpers
│   ├── api.ts                    # API client with JWT injection
│   ├── auth.ts                   # Cognito authentication helpers
│   ├── env.ts                    # Environment variable validation (Zod)
│   ├── types.ts                  # Shared TypeScript types
│   ├── utils.ts                  # Utility functions (cn, formatters)
│   ├── errors.ts                 # Custom error classes
│   ├── error-handling.ts         # Error handling utilities
│   ├── swr.ts                    # SWR configuration
│   ├── amplify-config.ts         # Amplify configuration
│   ├── upload-config.ts          # Upload validation rules
│   ├── upload-validators.ts      # File validation functions
│   └── image-compression.ts      # Client-side image optimization
│
├── docs/                         # Frontend documentation
│   ├── getting-started/
│   │   ├── QUICK_START.md
│   │   ├── ENVIRONMENT_SETUP.md
│   │   └── PROJECT_OVERVIEW.md
│   ├── development/
│   │   ├── AUTHENTICATION.md
│   │   ├── API_CLIENT.md
│   │   ├── DESIGN_SYSTEM.md
│   │   └── ERROR_HANDLING.md
│   ├── components/
│   │   ├── CARDS.md
│   │   ├── UPLOAD.md
│   │   └── NAVIGATION.md
│   ├── architecture/
│   │   ├── PROJECT_STRUCTURE.md
│   │   ├── TECHNOLOGY_STACK.md
│   │   └── GIT_SUBTREE.md
│   └── troubleshooting/
│       ├── COGNITO_TROUBLESHOOTING.md
│       └── OAUTH_SETUP.md
│
├── public/                       # Static assets
├── .env.example                  # Environment variable template
├── next.config.mjs               # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── vitest.config.ts              # Vitest configuration
├── components.json               # shadcn/ui configuration
└── package.json                  # Dependencies and scripts
```

### Path Aliases

- `@/*` — Project root (e.g., `@/components/ui/button`)
- `@/components/*` — Components directory
- `@/lib/*` — Library/utilities directory
- `@/lib/types` — Shared frontend types and Zod schemas

---

## Performance & Scalability

### Performance Targets

- **Largest Contentful Paint (LCP)**: < 2.5 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Interaction to Next Paint (INP)**: < 200ms
- **Time to Interactive (TTI)**: < 3.5 seconds
- **First Contentful Paint (FCP)**: < 1.8 seconds

### Optimization Strategies

**Code Splitting**:

- Route-based splitting via Next.js App Router
- Component-level lazy loading with `React.lazy()` and `Suspense`
- Dynamic imports for heavy libraries (Recharts, image compression)

**Image Optimization**:

- Next.js Image component with automatic WebP conversion
- Responsive images with `srcset` for different screen sizes
- Lazy loading with intersection observer

**Caching**:

- SWR client-side caching with stale-while-revalidate
- API Gateway response caching (5-minute TTL for public endpoints)
- CloudFront CDN for static assets

**Bundle Size**:

- Tree-shaking with ES modules
- Tailwind CSS purging removes unused styles
- Gzip compression on Amplify Hosting

### Scalability

- **Serverless Architecture**: Auto-scales with demand (no server management)
- **CDN Distribution**: CloudFront edge locations for global low-latency
- **Stateless Frontend**: No server-side sessions (JWT-based auth)
- **Horizontal Scaling**: Amplify Hosting auto-scales compute resources

---

## AWS Amplify Hosting

CollectIQ web app deploys to AWS Amplify Hosting for seamless CI/CD and global distribution:

### Deployment Configuration

1. **Connect Repository**: Link GitHub repository to Amplify Console
2. **Build Settings**: Use default Next.js build spec
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - corepack enable
           - pnpm install --frozen-lockfile
       build:
         commands:
           - pnpm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
         - .next/cache/**/*
   ```
3. **Environment Variables**: Configure in Amplify Console (see `.env.example`)
4. **Custom Domain**: Optional CNAME for branded domain (e.g., `app.collectiq.com`)

### Continuous Deployment

- **Automatic Builds**: Triggered on push to `main` branch
- **Preview Environments**: Ephemeral deployments for pull requests
- **Rollback**: One-click rollback to previous deployment
- **Monitoring**: CloudWatch metrics for build success rate and deployment duration

---

## Documentation

📚 **[Complete Documentation](./docs/)** — All frontend documentation is organized in the `docs/` directory

### Quick Links

**Getting Started**:

- [Quick Start Guide](./docs/getting-started/QUICK_START.md) — Get up and running in 5 minutes
- [Environment Setup](./docs/getting-started/ENVIRONMENT_SETUP.md) — Configure AWS credentials and Cognito
- [Project Overview](./docs/getting-started/PROJECT_OVERVIEW.md) — Understand the architecture

**Development**:

- [Authentication Guide](./docs/development/AUTHENTICATION.md) — OAuth 2.0 + PKCE implementation
- [API Client](./docs/development/API_CLIENT.md) — API integration patterns
- [Design System](./docs/development/DESIGN_SYSTEM.md) — UI components and styling
- [Error Handling](./docs/development/ERROR_HANDLING.md) — Error boundaries and user feedback

**Components**:

- [Cards Components](./docs/components/CARDS.md) — Valuation and authenticity UI
- [Upload Components](./docs/components/UPLOAD.md) — Camera capture and file upload
- [Navigation Components](./docs/components/NAVIGATION.md) — Header and sidebar

**Architecture**:

- [Project Structure](./docs/architecture/PROJECT_STRUCTURE.md) — File organization
- [Technology Stack](./docs/architecture/TECHNOLOGY_STACK.md) — Framework and library choices
- [Git Subtree](./docs/architecture/GIT_SUBTREE.md) — Monorepo management

**Troubleshooting**:

- [Cognito Troubleshooting](./docs/troubleshooting/COGNITO_TROUBLESHOOTING.md) — Common auth issues
- [OAuth Setup](./docs/troubleshooting/OAUTH_SETUP.md) — Redirect URI configuration

---

## Contributing

For development guidelines, coding standards, and architecture decisions:

1. Read `../../WARP.md` for comprehensive developer guidance
2. Review `../../AGENTS.md` for repository conventions
3. Consult `../../.kiro/specs/` for granular requirements
4. Follow TypeScript non-strict mode conventions
5. Ensure `pnpm lint` and `pnpm typecheck` pass before committing
6. Include tests for new features (Vitest + React Testing Library)
7. Update `.env.example` when adding new environment variables
8. Document new components in `docs/components/`

---

## Learn More

**Next.js**:

- [Next.js Documentation](https://nextjs.org/docs) — Framework features and API reference
- [App Router Guide](https://nextjs.org/docs/app) — Server Components and routing

**Styling**:

- [Tailwind CSS v4](https://tailwindcss.com/docs) — Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) — Accessible component library

**AWS**:

- [AWS Amplify Hosting](https://docs.amplify.aws/) — Deployment and hosting
- [Amazon Cognito](https://docs.aws.amazon.com/cognito/) — Authentication and authorization

**Testing**:

- [Vitest](https://vitest.dev/) — Fast unit testing
- [Playwright](https://playwright.dev/) — End-to-end testing
- [React Testing Library](https://testing-library.com/react) — Component testing

---

## License

This project is proprietary and confidential.

---

## Contact

For questions, partnerships, or investment inquiries, please contact the CollectIQ team.
