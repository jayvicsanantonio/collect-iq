# Frontend Documentation

Complete documentation for the CollectIQ Next.js frontend application.

## Overview

The CollectIQ frontend is built with Next.js 14 (App Router), React 18, Tailwind CSS v4, and deployed on AWS Amplify. It provides a modern, responsive interface for card collectors to upload, analyze, and manage their Pokémon TCG collections.

## Documentation

### Project Specification

- [Frontend Project Specification](./Frontend-Project-Specification.md) - Complete frontend architecture and requirements

### Design & UX

- [Design System](./Design-System.md) - Design tokens, components, and patterns
- [Complete Wireframes & UX Flows](./Complete-Wireframes-UX-Flows.md) - User flows and wireframes
- [UI Copy](./UI-Copy.md) - Microcopy and messaging guidelines

### Authentication

- [Authentication Flow](./Authentication-Flow.md) - OAuth 2.0 + PKCE flow with Cognito

### Features

- [Image Upload Specification](./Image-Upload-Spec.md) - Image upload feature specification
- [Image Upload Acceptance Criteria](./Image-Upload-Acceptance.md) - Acceptance criteria and testing

## Technology Stack

### Core Framework

- **Next.js 14** - React framework with App Router
- **React 18** - UI library with Server Components
- **TypeScript** - Type-safe development

### Styling

- **Tailwind CSS v4** - Utility-first CSS with `@theme` directive
- **shadcn/ui** - Accessible component library built on Radix UI
- **CSS Variables** - Theme customization

### State Management

- **SWR** - Data fetching and caching
- **React Context** - Global state (auth, theme)
- **URL State** - Search params for filters

### Authentication

- **AWS Amplify** - Authentication library
- **Amazon Cognito** - User management with Hosted UI
- **OAuth 2.0 + PKCE** - Secure authentication flow

### Data Fetching

- **SWR** - Client-side data fetching with caching
- **API Client** - Type-safe API wrapper
- **Optimistic Updates** - Instant UI feedback

### Testing

- **Vitest** - Unit testing
- **React Testing Library** - Component testing
- **Playwright** - E2E testing
- **axe-core** - Accessibility testing

## Project Structure

```
apps/web/
├── app/                          # Next.js App Router
│   ├── (public)/                # Unauthenticated routes
│   │   ├── page.tsx            # Landing page
│   │   └── auth/               # Auth callback
│   ├── (protected)/            # Authenticated routes
│   │   ├── upload/             # Card upload
│   │   ├── vault/              # Card collection
│   │   └── cards/[id]/         # Card detail
│   └── api/                    # API routes
├── components/                  # React components
│   ├── ui/                     # shadcn/ui components
│   ├── navigation/             # Header, sidebar
│   ├── upload/                 # Upload components
│   └── cards/                  # Card components
├── lib/                        # Utilities
│   ├── api.ts                  # API client
│   ├── auth.ts                 # Authentication
│   └── swr.ts                  # SWR configuration
└── public/                     # Static assets
```

## Key Features

### 1. Card Upload

- Drag-and-drop or camera capture
- HEIC/HEIF support with automatic conversion
- Real-time upload progress
- Image validation and error handling

### 2. AI Analysis

- Automatic trigger after upload
- Real-time progress updates
- Pricing from multiple sources
- Authenticity detection

### 3. Card Vault

- Grid/list view toggle
- Search and filter
- Sort by value, date, name
- Pagination with infinite scroll

### 4. Card Detail

- High-resolution image display
- AI insights and reasoning
- Pricing breakdown
- Authenticity score
- Manual revaluation

### 5. Authentication

- Cognito Hosted UI
- OAuth 2.0 + PKCE flow
- Automatic token refresh
- Protected routes

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm web:dev

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Lint
pnpm lint

# Type check
pnpm typecheck
```

### Environment Variables

See [Configuration Reference](../configuration/Environment-Variables.md) for complete list.

Key frontend variables:

```bash
NEXT_PUBLIC_API_URL=https://your-api-gateway-url
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_DOMAIN=your-cognito-domain
NEXT_PUBLIC_S3_BUCKET=your-upload-bucket
```

### Building for Production

```bash
# Build
pnpm web:build

# Start production server
pnpm web:start
```

## Design System

### Colors

- **Primary**: Blue (#3B82F6) - CTAs, links
- **Success**: Green (#10B981) - Positive states
- **Warning**: Yellow (#F59E0B) - Cautions
- **Error**: Red (#EF4444) - Errors, destructive actions
- **Neutral**: Gray scale - Text, backgrounds

### Typography

- **Headings**: Inter (font-sans)
- **Body**: Inter (font-sans)
- **Mono**: JetBrains Mono (font-mono)

### Components

All components follow:

- **Accessibility**: WCAG 2.1 AA compliance
- **Responsive**: Mobile-first design
- **Dark mode**: Full theme support
- **Type-safe**: TypeScript interfaces

## Related Documentation

- [Backend Documentation](../backend/README.md) - Backend API and agents
- [Infrastructure Documentation](../infrastructure/README.md) - AWS infrastructure
- [Configuration Reference](../configuration/README.md) - Environment variables
- [Development Guide](../development/README.md) - Development workflows

## Navigation

- [← Back to Main Documentation](../README.md)

---

**Last Updated**: October 22, 2025  
**Framework**: Next.js 14 with App Router  
**Deployment**: AWS Amplify
