# CollectIQ Web Application

Next.js 14 frontend for CollectIQ - AI-powered trading card intelligence platform.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
pnpm install
```

Create an `.env.local` file in the project root with the environment variables validated in `lib/env.ts`:

- `NEXT_PUBLIC_AWS_REGION`
- `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
- `NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`
- `NEXT_PUBLIC_COGNITO_DOMAIN`
- `NEXT_PUBLIC_OAUTH_REDIRECT_URI`
- `NEXT_PUBLIC_OAUTH_LOGOUT_URI`
- `NEXT_PUBLIC_API_BASE`

See [AUTHENTICATION.md](./AUTHENTICATION.md) for Cognito setup details.

### Development

```bash
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

### Build

```bash
pnpm build
pnpm start
```

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

## Project Structure

```
collect-iq-ui/
├── app/                    # Next.js App Router
├── components/             # React components
│   ├── auth/               # Authentication components
│   ├── cards/              # Card-related components
│   ├── upload/             # Upload components
│   ├── vault/              # Vault components
│   └── ui/                 # shadcn/ui primitives
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, API client, types
├── public/                 # Static assets (if any)
├── styles/                 # Additional styles
└── next.config.mjs         # Next.js configuration
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

- `@/*` - Project root
- `@/components/*` - Components directory
- `@/lib/*` - Library/utilities directory
- `@/lib/types` - Shared frontend types and Zod schemas

## Documentation

- [AUTHENTICATION.md](./AUTHENTICATION.md) - Complete authentication guide
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Design system and styling guide
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) - Environment configuration

## AWS Amplify Hosting

- Connect this repository to Amplify Hosting and set the environment variables above in the Amplify console.
- Use the default Next.js build commands (based on [Amplify's framework build spec](https://docs.amplify.aws/nextjs/deploy-and-host/fullstack-branching/mono-and-multi-repos/)):
  - Pre-build: `corepack enable` and `pnpm install --frozen-lockfile`
  - Build: `pnpm run build`
- Configure the artifact base directory as `.next` so Amplify picks up server and static assets.
- No custom post-build packaging is required; Amplify provisions the compute layer automatically for SSR.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
