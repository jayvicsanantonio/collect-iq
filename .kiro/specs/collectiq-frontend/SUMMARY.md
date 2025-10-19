# Frontend Specification Update Summary

## What Was Updated

I've comprehensively updated the CollectIQ frontend specifications to align with the actual backend implementation. The updates ensure the frontend can properly integrate with all available backend APIs and data structures.

## Key Changes

### 1. Requirements Document Updates

**Updated Requirements:**

- **Requirement 2 (Upload):** Now specifies POST /upload/presign endpoint and POST /cards for card creation
- **Requirement 3 (Identification):** Replaced with "Card Analysis & Processing" to reflect Step Functions workflow
- **Requirement 5 (Valuation):** Updated to use Card object fields (valueLow, valueMedian, valueHigh) and POST /cards/{id}/revalue
- **Requirement 6 (Vault):** Updated to use GET /cards with cursor-based pagination
- **Requirement 7 (Card Detail):** Updated to use GET /cards/{id} and display real Card data

### 2. Design Document Updates

**API Client Interface:**

- Added proper method signatures matching backend endpoints
- Included Idempotency-Key header requirements
- Added PresignResponse, ListCardsResponse, RevalueResponse types
- Specified cursor-based pagination

### 3. Tasks Document Updates

**Updated Tasks:**

- Task 4.3: Specified exact API endpoints and Idempotency-Key usage
- Task 5.4: Added POST /cards call after S3 upload
- Task 6: Replaced "identification" with "card processing" to reflect async analysis
- Task 7: Updated to use authenticityScore and authenticitySignals from Card object
- Task 8: Updated to use valuation fields from Card object and POST /cards/{id}/revalue
- Task 9.5: Specified DELETE /cards/{id} returns 204 No Content
- Task 10.5: Added Idempotency-Key for revaluation

## New Documents Created

### 1. BACKEND_INTEGRATION.md

**Purpose:** Comprehensive guide for integrating with backend APIs

**Contents:**

- Complete API endpoint reference with request/response formats
- Implementation patterns for common flows (upload, polling, pagination, etc.)
- Error handling guide with ProblemDetails format
- Data flow architecture diagrams
- Frontend page structure recommendations
- Testing strategy
- Security and performance considerations

**Key Sections:**

- All 6 API endpoints documented in detail
- 5 implementation patterns with code examples
- Error handling table with user messages
- Idempotency pattern explanation
- Data flow architecture diagram

### 2. IMPLEMENTATION_ROADMAP.md

**Purpose:** Phased approach to building the frontend

**Contents:**

- 8 phases from UI layouts to deployment
- Detailed task breakdown for each phase
- Success criteria for each phase
- Timeline estimates (7-9 weeks total)
- Priority order for features
- Next immediate steps

**Phases:**

1. Complete UI Layouts (Non-Functional) - 1-2 weeks
2. Backend Integration - Upload Flow - 1 week
3. Backend Integration - Card Processing & Detail - 1 week
4. Backend Integration - Vault Management - 1 week
5. Backend Integration - Revaluation - 3-4 days
6. Polish & Optimization - 1 week
7. Testing - 1 week
8. Deployment & Documentation - 3-4 days

### 3. QUICK_START.md

**Purpose:** Quick reference for developers

**Contents:**

- Project structure overview
- Backend API endpoints table
- Shared types reference
- Complete API client implementation
- 5 common patterns with code examples
- Error handling implementation
- Environment variables
- Development commands

**Key Features:**

- Copy-paste ready code examples
- Complete API client implementation
- All common patterns covered
- Error handling examples

## Backend APIs Documented

### Available Endpoints

1. **POST /upload/presign**
   - Generate presigned S3 URL
   - Request: filename, contentType, sizeBytes
   - Response: uploadUrl, key, expiresIn

2. **POST /cards** (Idempotency-Key required)
   - Create card record and trigger analysis
   - Request: frontS3Key, optional metadata
   - Response: Card object (analysis fields undefined initially)

3. **GET /cards**
   - List user's cards with pagination
   - Query: cursor, limit
   - Response: items[], nextCursor

4. **GET /cards/{id}**
   - Get card details
   - Response: Card object

5. **DELETE /cards/{id}**
   - Delete card (soft delete by default)
   - Response: 204 No Content

6. **POST /cards/{id}/revalue** (Idempotency-Key required)
   - Trigger revaluation workflow
   - Request: forceRefresh
   - Response: executionArn, status, message

## Key Implementation Patterns

### 1. Upload Flow

```
User selects file
  → POST /upload/presign (get presigned URL)
  → PUT to S3 (direct upload with progress)
  → POST /cards (create card record)
  → Redirect to /cards/{id} (processing view)
```

### 2. Card Processing

```
Card created with undefined analysis fields
  → Poll GET /cards/{id} every 5 seconds
  → Check if authenticityScore and valueLow are defined
  → Display results when complete
```

### 3. Vault Display

```
GET /cards (fetch collection)
  → Calculate portfolio stats client-side
  → Apply filters/sorting client-side
  → Use cursor for pagination
```

### 4. Revaluation

```
POST /cards/{id}/revalue (trigger workflow)
  → Receive 202 Accepted with executionArn
  → Poll GET /cards/{id} for updated data
  → Check updatedAt timestamp for changes
  → Display toast when complete
```

### 5. Optimistic Delete

```
Remove card from UI immediately
  → DELETE /cards/{id}
  → If error, rollback (restore to UI)
  → Show toast notification
```

## Card Data Structure

The Card object from the backend includes:

**Metadata:**

- cardId, userId, name, set, number, rarity, conditionEstimate
- frontS3Key, backS3Key
- createdAt, updatedAt

**Analysis Results (undefined while processing):**

- idConfidence (0-1)
- authenticityScore (0-1)
- authenticitySignals (visualHashConfidence, textMatchConfidence, holoPatternConfidence, borderConsistency, fontValidation)
- valueLow, valueMedian, valueHigh (USD)
- compsCount
- sources[] (eBay, TCGPlayer, PriceCharting)

## Frontend Pages Structure

### 1. Upload Page (`/upload`)

- UploadDropzone (drag-and-drop + file picker)
- CameraCapture (mobile camera)
- UploadProgress (progress bar)
- Flow: presign → S3 → create card → redirect

### 2. Card Detail Page (`/cards/{id}`)

- CardImage (from frontS3Key)
- AuthenticitySection (score + signals)
- ValuationSection (price range + sources)
- CardActions (re-evaluate, delete, share)
- CardProcessing (loading state while analysis runs)

### 3. Vault Page (`/vault`)

- PortfolioSummary (total value, card count, sparkline)
- VaultFilters (set, rarity, authenticity)
- VaultGrid (responsive card grid)
- LoadMore (cursor-based pagination)

## Important Considerations

### Idempotency

- POST /cards and POST /cards/{id}/revalue require Idempotency-Key header
- Generate new UUID for each operation
- Backend returns 409 Conflict if key is reused

### Polling

- Poll GET /cards/{id} every 5 seconds for processing/revaluation
- Stop when authenticityScore and valueLow are defined
- Add timeout after 5 minutes

### Error Handling

- All errors follow RFC 7807 ProblemDetails format
- Parse status, title, detail fields
- Display user-friendly messages
- Provide retry options

### Performance

- Use cursor-based pagination for vault
- Implement optimistic updates for mutations
- Add loading skeletons for async operations
- Lazy load heavy components (Recharts)

## Next Steps for Frontend Development

### Immediate (Phase 1: UI Layouts)

1. Build card processing page UI with mock data
2. Enhance card detail page with all sections
3. Improve vault page with filters and portfolio summary
4. Add error pages (404, 403)

### Short-term (Phase 2-3: Core Integration)

1. Integrate upload flow with backend APIs
2. Implement card processing with polling
3. Display real card data in detail view
4. Handle all error states

### Medium-term (Phase 4-5: Full Features)

1. Integrate vault with pagination
2. Implement delete functionality
3. Add revaluation feature
4. Implement filters and sorting

### Long-term (Phase 6-8: Polish & Deploy)

1. Add comprehensive error handling
2. Optimize performance
3. Ensure accessibility
4. Write tests
5. Deploy to production

## Resources

All documentation is located in `.kiro/specs/collectiq-frontend/`:

- **requirements.md** - Updated functional requirements
- **design.md** - Updated design document
- **tasks.md** - Updated implementation tasks
- **image-upload-validation.md** - Image upload validation feature spec
- **BACKEND_INTEGRATION.md** - Complete API integration guide
- **IMPLEMENTATION_ROADMAP.md** - Phased implementation plan
- **QUICK_START.md** - Quick reference for developers
- **SUMMARY.md** - This document

### Additional Documentation

Detailed specifications in `docs/Frontend/`:

- **image-upload-spec.md** - Complete technical specification for upload validation
- **image-upload-acceptance.md** - E2E acceptance criteria (16 groups)
- **ui-copy.md** - All user-facing text and copy guidelines

Component documentation in `apps/web/components/upload/`:

- **README.md** - Upload component API, usage, and configuration

## Success Criteria

The frontend is complete when:

- ✅ All authenticated pages are functional with real backend data
- ✅ Upload flow works end-to-end
- ✅ Card detail displays real analysis results
- ✅ Vault displays real collection with pagination
- ✅ Revaluation feature works
- ✅ All CRUD operations work
- ✅ Error handling is comprehensive
- ✅ Performance meets targets
- ✅ Accessibility meets WCAG 2.2 AA
- ✅ Test coverage >80%
- ✅ Deployed to production

## Conclusion

The frontend specifications are now fully aligned with the backend implementation. The new documentation provides:

1. **Clear API contracts** - Exact request/response formats for all endpoints
2. **Implementation patterns** - Proven patterns for common flows
3. **Phased approach** - Structured roadmap from UI to production
4. **Quick reference** - Copy-paste ready code examples
5. **Comprehensive guidance** - Everything needed to build the frontend

The frontend can now be built systematically, starting with UI layouts and progressively integrating backend APIs, ensuring a smooth development process and successful integration.
