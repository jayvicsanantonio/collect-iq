# CollectIQ Web Application

Next.js 14 frontend for CollectIQ - AI-powered trading card intelligence platform.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

From the repository root:

```bash
pnpm install
```

### Environment Setup

1. Copy the example environment file:

```bash
cp apps/web/.env.example apps/web/.env.local
```

2. Fill in the required environment variables:
   - AWS region
   - Cognito User Pool ID, Client ID, and Domain
   - OAuth redirect URIs
   - API base URL

For detailed authentication setup instructions, see [AUTHENTICATION.md](./AUTHENTICATION.md).

### Development

Start the development server:

```bash
pnpm web:dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build for production:

```bash
pnpm web:build
```

Start the production server:

```bash
pnpm web:start
```

### Type Checking

Run TypeScript type checking:

```bash
pnpm typecheck
```

### Linting

Run ESLint:

```bash
pnpm lint
```

## Project Structure

```
apps/web/
├── app/                    # Next.js App Router
│   ├── (public)/          # Public routes
│   ├── (protected)/       # Protected routes
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── cards/            # Card-related components
│   ├── upload/           # Upload components
│   ├── vault/            # Vault components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utilities and helpers
│   ├── env.ts            # Environment validation
│   └── utils.ts          # Utility functions
└── styles/               # Additional styles
```

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (non-strict mode)
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Data Fetching**: SWR
- **Validation**: Zod
- **Authentication**: Amazon Cognito

## Path Aliases

- `@/*` - Root src directory
- `@/components/*` - Components directory
- `@/lib/*` - Library/utilities directory
- `@collectiq/shared` - Shared package (types and schemas)

## Documentation

- [AUTHENTICATION.md](./AUTHENTICATION.md) - Complete authentication guide
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Design system and styling guide
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) - Environment configuration

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
