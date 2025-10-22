# CollectIQ Quick Start Guide

Get up and running with CollectIQ in minutes.

## Prerequisites

- Node.js 20+
- pnpm 9+
- AWS Account (for Cognito setup)

## Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd collect-iq
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Configure environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your AWS Cognito configuration:

   ```env
   NEXT_PUBLIC_AWS_REGION=us-east-1
   NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
   NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
   NEXT_PUBLIC_COGNITO_DOMAIN=collectiq.auth.us-east-1.amazoncognito.com
   NEXT_PUBLIC_OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
   NEXT_PUBLIC_OAUTH_LOGOUT_URI=http://localhost:3000/landing
   NEXT_PUBLIC_API_BASE=https://api.collectiq.com
   ```

   See [Environment Setup](./ENVIRONMENT_SETUP.md) for detailed configuration.

4. **Start the development server:**

   ```bash
   pnpm dev
   ```

   The app will be available at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
collect-iq/
├── apps/web/              # Next.js frontend
│   ├── app/               # App Router pages
│   ├── components/        # React components
│   ├── lib/               # Utilities and API client
│   └── hooks/             # Custom React hooks
├── docs/                  # Documentation (you are here)
├── .kiro/                 # Kiro IDE configuration
│   ├── specs/             # Feature specifications
│   └── steering/          # AI assistant guidance
└── package.json           # Root workspace config
```

## Common Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run ESLint
pnpm typecheck        # TypeScript type checking

# Testing
pnpm test             # Run tests
pnpm test:e2e         # Run E2E tests
```

## Key Features

### Authentication

- AWS Cognito Hosted UI with OAuth 2.0 + PKCE
- Automatic token refresh
- Protected routes with AuthGuard

### Upload Flow

1. User uploads card image (drag-and-drop or camera)
2. Image validated client-side
3. Presigned URL obtained from backend
4. Image uploaded to S3
5. AI pipeline processes card

### Vault

- View all uploaded cards
- Filter and sort collection
- View detailed card information
- Track valuation history

## Next Steps

1. **Set up Cognito** - Follow the [Authentication Guide](../development/AUTHENTICATION.md)
2. **Explore Components** - Check out the [Component Documentation](../components/)
3. **Understand Architecture** - Read the [Project Structure](../architecture/PROJECT_STRUCTURE.md)
4. **Review Design System** - See the [Design System Guide](../development/DESIGN_SYSTEM.md)

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Environment Variables Not Loading

- Ensure `.env.local` exists in the project root
- Restart the dev server after changing environment variables
- Check for typos in variable names

### Authentication Not Working

- Verify Cognito configuration in AWS Console
- Check callback URLs match exactly
- Clear browser cookies and localStorage
- See [Cognito Troubleshooting](../troubleshooting/COGNITO_TROUBLESHOOTING.md)

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
