# API Client and Data Layer Implementation

## Overview

This PR implements the complete API client and data layer for the CollectIQ frontend, providing type-safe communication with the backend and efficient data fetching with SWR.

## Changes

### 🔧 API Client (`apps/web/lib/api.ts`)

- **Typed fetch wrapper** with automatic credential inclusion (cookies for JWT)
- **RFC 7807 ProblemDetails** error parsing with custom `ApiError` class
- **Exponential backoff retry logic** for GET requests (3 attempts: 1s, 2s, 4s)
- **Request ID tracking** for distributed tracing
- **Zod schema validation** for all API responses
- **Type-safe API methods**:
  - `getPresignedUrl()` - S3 upload presigning
  - `createCard()` - Card creation
  - `getCards()` - Paginated card list with cursor support
  - `getCard()` - Single card retrieval
  - `deleteCard()` - Card deletion
  - `refreshValuation()` - Valuation updates

### 📊 SWR Data Fetching (`apps/web/lib/swr.ts`)

- **Global SWR configuration** with optimized settings
- **Custom hooks**:
  - `useCards()` - Fetch paginated card list
  - `useCard()` - Fetch single card
  - `useDeleteCard()` - Delete card with optimistic updates
  - `useRefreshValuation()` - Refresh card valuation
- **Cache management**:
  - User-scoped cache key strategy
  - Cache invalidation helpers
  - Optimistic UI update utilities
- **SWR Provider** component for app-wide configuration

### 📦 Shared Schemas (`packages/shared/src/schemas.ts`)

Extended with frontend-specific schemas:

- `ProblemDetailsSchema` - RFC 7807 error format
- `ValuationDataSchema` - Frontend valuation display data
- `AuthenticityDetailsSchema` - Authenticity analysis details

### 🔗 Integration

- Added `SWRProvider` to `apps/web/app/layout.tsx`
- Fixed module resolution in `packages/shared/src/index.ts`

### 📚 Documentation

- Comprehensive `apps/web/lib/README.md` with:
  - API client usage examples
  - SWR configuration details
  - Error handling guide
  - Cache strategy documentation

## Task Completion

✅ Task 4.1: Create typed API client  
✅ Task 4.2: Set up shared schemas  
✅ Task 4.3: Implement API endpoints  
✅ Task 4.4: Set up SWR for data fetching

## Testing

- All TypeScript diagnostics pass
- ESLint checks pass
- No build errors

## Requirements Addressed

- **11.1**: Type-safe API client with schema validation
- **11.2**: Error handling with ProblemDetails format
- **2.4**: S3 presigned URL generation
- **5.8**: Card creation endpoint
- **6.9**: Card list and detail fetching with SWR
- **7.6**: Valuation refresh endpoint

## Next Steps

This implementation provides the foundation for:

- Upload flow (Task 5)
- Card detail screens (Task 6)
- Vault management (Task 7)
- Authentication integration (Task 3)

## Breaking Changes

None - this is new functionality.

## Dependencies

- Uses existing `swr` package (already in package.json)
- Uses existing `zod` package (already in package.json)
- Extends `@collectiq/shared` package
