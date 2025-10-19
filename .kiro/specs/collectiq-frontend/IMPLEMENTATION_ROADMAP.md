# Frontend Implementation Roadmap

## Overview

This document provides a phased approach to building the CollectIQ frontend, aligned with the actual backend implementation. The focus is on building non-functional UI layouts first, then progressively integrating backend APIs.

## Current Status

✅ **Completed:**

- Project setup and configuration
- Design system foundation (tokens, components, theme)
- Authentication infrastructure (Cognito Hosted UI integration)
- API client foundation with shared types
- Basic upload page (non-functional)
- Basic vault page (non-functional)
- Authenticity and valuation components (non-functional)

## Phase 1: Complete UI Layouts (Non-Functional)

**Goal:** Build all authenticated user pages with static/mock data to establish visual design and user flow.

### 1.1 Card Processing Page

- [ ] Create `/cards/{id}/processing` route or processing state in card detail
- [ ] Design processing screen with animated status indicators
- [ ] Show progress for: feature extraction, authenticity analysis, valuation
- [ ] Add estimated time remaining indicator
- [ ] Create error state with retry button
- [ ] Use mock data to simulate processing states

### 1.2 Enhanced Card Detail Page

- [ ] Expand `/cards/{id}` page with complete layout
- [ ] Add large zoomable card image section
- [ ] Create authenticity section with:
  - AuthenticityBadge with score
  - Detailed signals breakdown (visual hash, text match, holo pattern, border, font)
  - Visual representations (progress bars, charts)
  - Rationale text display
- [ ] Create valuation section with:
  - Price range display (low/median/high)
  - Data sources display
  - Comparable sales count
  - Last updated timestamp
- [ ] Add action buttons: Re-evaluate, Delete, Share
- [ ] Use mock Card data with all fields populated

### 1.3 Enhanced Vault Page

- [ ] Improve vault grid layout and card thumbnails
- [ ] Add portfolio summary with:
  - Total value calculation
  - Card count
  - 14-day performance sparkline (mock data)
- [ ] Enhance filters UI:
  - Set dropdown
  - Rarity dropdown
  - Authenticity score slider
  - Sort options (value, date, rarity)
- [ ] Add empty state with upload CTA
- [ ] Add loading skeletons
- [ ] Use mock Card array data

### 1.4 Upload Flow Refinement

- [ ] Enhance upload page UI
- [ ] Improve camera capture modal
- [ ] Add better progress indicators
- [ ] Create upload success state
- [ ] Add error states for validation failures

### 1.5 Error Pages

- [ ] Create 404 page (card not found)
- [ ] Create 403 page (forbidden access)
- [ ] Create generic error page
- [ ] Add error boundaries

**Deliverable:** Complete, visually polished UI for all authenticated pages using mock data.

---

## Phase 2: Backend Integration - Upload Flow

**Goal:** Make the upload flow functional with real backend APIs.

### 2.1 Presigned URL Integration

- [ ] Update API client with `getPresignedUrl()` method
- [ ] Implement POST /upload/presign request
- [ ] Validate PresignResponse with Zod schema
- [ ] Handle errors (400, 413, 415)

### 2.2 S3 Upload Implementation

- [ ] Implement direct S3 upload with XMLHttpRequest
- [ ] Add progress tracking
- [ ] Handle upload errors and retries
- [ ] Add cancel functionality

### 2.3 Card Creation Integration

- [ ] Update API client with `createCard()` method
- [ ] Implement POST /cards with Idempotency-Key header
- [ ] Generate UUID for idempotency key
- [ ] Validate Card response with Zod schema
- [ ] Handle errors (400, 409)

### 2.4 Upload Flow Orchestration

- [ ] Connect presign → S3 upload → card creation
- [ ] Add proper error handling at each step
- [ ] Implement cleanup on unmount
- [ ] Redirect to card detail after creation
- [ ] Add toast notifications for success/error

**Deliverable:** Functional upload flow that creates card records in backend.

---

## Phase 3: Backend Integration - Card Processing & Detail

**Goal:** Display real card data and handle processing states.

### 3.1 Get Card Integration

- [ ] Update API client with `getCard()` method
- [ ] Implement GET /cards/{id} request
- [ ] Validate Card response with Zod schema
- [ ] Handle errors (400, 403, 404)

### 3.2 Processing State Detection

- [ ] Check if `authenticityScore` is undefined
- [ ] Check if `valueLow` is undefined
- [ ] Display processing screen if analysis incomplete
- [ ] Show appropriate loading indicators

### 3.3 Polling Implementation

- [ ] Implement polling logic for GET /cards/{id}
- [ ] Poll every 5 seconds while processing
- [ ] Stop polling when analysis complete
- [ ] Add timeout after 5 minutes
- [ ] Handle polling errors gracefully

### 3.4 Card Detail Display

- [ ] Display card image from `frontS3Key` (may need presigned URL for display)
- [ ] Display authenticity data:
  - `authenticityScore` in AuthenticityBadge
  - `authenticitySignals` breakdown
- [ ] Display valuation data:
  - `valueLow`, `valueMedian`, `valueHigh`
  - `compsCount`
  - `sources` array
  - `updatedAt` timestamp
- [ ] Display card metadata:
  - `name`, `set`, `number`, `rarity`, `conditionEstimate`

### 3.5 Error Handling

- [ ] Handle 404 (card not found)
- [ ] Handle 403 (not owner)
- [ ] Handle analysis failures
- [ ] Add retry options

**Deliverable:** Functional card detail page showing real analysis results.

---

## Phase 4: Backend Integration - Vault Management

**Goal:** Display real card collection with pagination and management features.

### 4.1 List Cards Integration

- [ ] Update API client with `getCards()` method
- [ ] Implement GET /cards with pagination
- [ ] Validate ListCardsResponse with Zod schema
- [ ] Handle errors (400)

### 4.2 Vault Display

- [ ] Fetch cards on page load
- [ ] Display cards in grid
- [ ] Calculate portfolio stats from real data:
  - Sum of `valueMedian` for total value
  - Count of cards
  - Mock sparkline (historical data not yet available)
- [ ] Show loading skeletons during fetch

### 4.3 Pagination Implementation

- [ ] Implement cursor-based pagination
- [ ] Add "Load More" button
- [ ] Store and use `nextCursor` from response
- [ ] Handle end of list (no nextCursor)

### 4.4 Client-Side Filtering

- [ ] Filter by `set`
- [ ] Filter by `rarity`
- [ ] Filter by `authenticityScore` (min threshold)
- [ ] Update URL query parameters

### 4.5 Client-Side Sorting

- [ ] Sort by `valueMedian` (ascending/descending)
- [ ] Sort by `createdAt` (newest/oldest)
- [ ] Sort by `rarity` (using predefined order)
- [ ] Update URL query parameters

### 4.6 Delete Card Integration

- [ ] Update API client with `deleteCard()` method
- [ ] Implement DELETE /cards/{id} request
- [ ] Handle 204 No Content response
- [ ] Implement optimistic UI update
- [ ] Rollback on error
- [ ] Show confirmation dialog
- [ ] Update portfolio stats after deletion

**Deliverable:** Functional vault with real card data, pagination, filtering, and deletion.

---

## Phase 5: Backend Integration - Revaluation

**Goal:** Enable users to refresh card valuations.

### 5.1 Revalue Card Integration

- [ ] Update API client with `revalueCard()` method
- [ ] Implement POST /cards/{id}/revalue with Idempotency-Key
- [ ] Validate RevalueResponse with Zod schema
- [ ] Handle errors (400, 403, 404)

### 5.2 Revaluation Flow

- [ ] Add "Refresh Valuation" button to card detail
- [ ] Generate UUID for Idempotency-Key
- [ ] Call POST /cards/{id}/revalue with `forceRefresh: true`
- [ ] Display 202 Accepted response
- [ ] Show loading state

### 5.3 Polling for Updates

- [ ] Poll GET /cards/{id} after revaluation
- [ ] Check for updated `updatedAt` timestamp
- [ ] Stop polling when data changes
- [ ] Add timeout after 2.5 minutes
- [ ] Show toast notification when complete

### 5.4 Vault Quick Actions

- [ ] Add refresh button to vault card thumbnails
- [ ] Trigger revaluation from vault
- [ ] Update card in list when complete
- [ ] Handle errors gracefully

**Deliverable:** Functional revaluation feature with polling and notifications.

---

## Phase 6: Polish & Optimization

**Goal:** Improve UX, performance, and error handling.

### 6.1 Loading States

- [ ] Add skeleton loaders for all async operations
- [ ] Improve progress indicators
- [ ] Add loading spinners where appropriate
- [ ] Ensure smooth transitions

### 6.2 Error Handling

- [ ] Implement comprehensive error handling for all API calls
- [ ] Parse ProblemDetails responses
- [ ] Display user-friendly error messages
- [ ] Add retry buttons where appropriate
- [ ] Handle network errors gracefully

### 6.3 Toast Notifications

- [ ] Add success toasts for all mutations
- [ ] Add error toasts for failures
- [ ] Implement toast queue
- [ ] Add auto-dismiss

### 6.4 Performance Optimization

- [ ] Implement code splitting for heavy components
- [ ] Lazy load Recharts library
- [ ] Optimize image loading with Next.js Image
- [ ] Add virtualization for large card lists (>200 items)
- [ ] Implement SWR caching strategy

### 6.5 Accessibility

- [ ] Add keyboard navigation
- [ ] Implement focus management
- [ ] Add ARIA labels and descriptions
- [ ] Ensure color contrast meets WCAG AA
- [ ] Test with screen readers

### 6.6 Mobile Optimization

- [ ] Test on mobile devices
- [ ] Optimize touch targets
- [ ] Implement responsive layouts
- [ ] Test camera capture on iOS/Android
- [ ] Handle orientation changes

**Deliverable:** Polished, performant, accessible application.

---

## Phase 7: Testing

**Goal:** Comprehensive test coverage for confidence in deployment.

### 7.1 Unit Tests

- [ ] Test API client methods
- [ ] Test Zod schema validation
- [ ] Test utility functions
- [ ] Test component logic
- [ ] Achieve >80% code coverage

### 7.2 Integration Tests

- [ ] Test upload flow (presign → S3 → create)
- [ ] Test polling logic
- [ ] Test pagination
- [ ] Test optimistic updates
- [ ] Test error handling

### 7.3 E2E Tests

- [ ] Test complete upload → analysis → detail flow
- [ ] Test revaluation flow
- [ ] Test vault browsing and filtering
- [ ] Test authentication flows
- [ ] Test error scenarios

### 7.4 Accessibility Tests

- [ ] Run axe-core automated checks
- [ ] Manual keyboard navigation testing
- [ ] Screen reader testing
- [ ] Generate accessibility report

### 7.5 Performance Tests

- [ ] Run Lighthouse CI
- [ ] Verify Core Web Vitals thresholds
- [ ] Test on slow networks
- [ ] Generate performance report

**Deliverable:** Comprehensive test suite with high coverage.

---

## Phase 8: Deployment & Documentation

**Goal:** Deploy to production and document for maintenance.

### 8.1 CI/CD Pipeline

- [ ] Set up GitHub Actions workflow
- [ ] Add lint and typecheck steps
- [ ] Add test execution
- [ ] Add build step
- [ ] Configure preview deployments

### 8.2 Production Deployment

- [ ] Set up AWS Amplify or Vercel hosting
- [ ] Configure environment variables
- [ ] Set up custom domain with SSL
- [ ] Configure CDN
- [ ] Set up error tracking (Sentry)

### 8.3 Documentation

- [ ] Write developer README
- [ ] Document environment variables
- [ ] Document API client usage
- [ ] Create architecture decision records
- [ ] Write user guide

### 8.4 Launch Preparation

- [ ] Complete end-to-end testing on staging
- [ ] Verify all features work
- [ ] Test on multiple devices/browsers
- [ ] Create launch checklist
- [ ] Prepare demo script

**Deliverable:** Production-ready application with comprehensive documentation.

---

## Key Implementation Notes

### Idempotency Pattern

All POST operations require an Idempotency-Key header:

```typescript
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4();
await api.createCard(data, idempotencyKey);
```

### Polling Pattern

For long-running operations (card analysis, revaluation):

```typescript
const pollForUpdates = async (cardId: string) => {
  const maxAttempts = 60;
  const pollInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const card = await api.getCard(cardId);

    if (isAnalysisComplete(card)) {
      return card;
    }

    await sleep(pollInterval);
  }

  throw new Error('Timeout');
};
```

### Optimistic Updates Pattern

For immediate UI feedback:

```typescript
// Store original state
const original = [...items];

// Update UI immediately
setItems((prev) => prev.filter((item) => item.id !== id));

try {
  await api.deleteItem(id);
} catch (error) {
  // Rollback on error
  setItems(original);
  showError(error);
}
```

### Error Handling Pattern

Parse ProblemDetails responses:

```typescript
try {
  await api.someOperation();
} catch (error) {
  if (error instanceof ApiError) {
    const problem = error.problem;
    showError(problem.detail);
  } else {
    showError('An unexpected error occurred');
  }
}
```

## Success Criteria

- [ ] All authenticated pages are functional with real backend data
- [ ] Upload flow works end-to-end (presign → S3 → create → analysis)
- [ ] Card detail page displays real analysis results
- [ ] Vault displays real card collection with pagination
- [ ] Revaluation feature works with polling
- [ ] All CRUD operations work (create, read, delete)
- [ ] Error handling is comprehensive and user-friendly
- [ ] Loading states are smooth and informative
- [ ] Performance meets Core Web Vitals targets
- [ ] Accessibility meets WCAG 2.2 AA standards
- [ ] Test coverage >80%
- [ ] Application is deployed to production

## Timeline Estimate

- **Phase 1 (UI Layouts):** 1-2 weeks
- **Phase 2 (Upload Flow):** 1 week
- **Phase 3 (Card Processing):** 1 week
- **Phase 4 (Vault Management):** 1 week
- **Phase 5 (Revaluation):** 3-4 days
- **Phase 6 (Polish):** 1 week
- **Phase 7 (Testing):** 1 week
- **Phase 8 (Deployment):** 3-4 days

**Total:** 7-9 weeks for complete implementation

## Priority Order

1. **Critical Path:** Upload → Card Creation → Processing → Detail View
2. **High Priority:** Vault Display → Pagination → Delete
3. **Medium Priority:** Revaluation → Filters → Sorting
4. **Low Priority:** Polish → Advanced Features → Historical Charts

## Next Immediate Steps

1. Complete Phase 1.1: Build card processing page UI with mock data
2. Complete Phase 1.2: Enhance card detail page UI with all sections
3. Complete Phase 1.3: Improve vault page UI with filters and portfolio summary
4. Begin Phase 2: Integrate upload flow with backend APIs
