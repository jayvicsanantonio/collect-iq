# Authenticity Analysis Interface

## Overview

Implements the authenticity analysis interface (Task 7 from collectiq-frontend spec) that displays AI-powered fake detection results with detailed metrics and visual breakdowns.

## Changes

### New Components

#### 1. AuthenticityBadge Component (`apps/web/components/cards/AuthenticityBadge.tsx`)

- Rounded pill badge displaying authenticity score (0-100%)
- Color-coded scoring system:
  - **Green (≥80%)**: Authentic - High confidence
  - **Yellow (50-80%)**: Uncertain - Medium confidence
  - **Red (<50%)**: Suspicious - Low confidence
- Interactive tooltip with detailed signal breakdown:
  - Visual Hash Confidence
  - Text Match Confidence
  - Holo Pattern Confidence
- Warning indicator for low scores
- Fully accessible with ARIA labels
- Not relying solely on color (uses icons and text)

#### 2. Authenticity Analysis Page (`apps/web/app/(protected)/authenticity/page.tsx`)

- New `/authenticity` route that receives card data via query parameters
- Split-view layout optimized for desktop and mobile:
  - **Left Panel**: Card image display with zoom capability
  - **Right Panel**: Detailed authenticity metrics
- Multiple sections:
  - **Overall Score**: Large AuthenticityBadge with status
  - **AI Analysis**: Human-readable rationale from Bedrock
  - **Signal Breakdown**: Individual confidence scores with progress bars
  - **Visual Fingerprint**: Perceptual hash analysis visualization
  - **Text Validation**: OCR text matching results
  - **Holographic Patterns**: Holo pattern detection analysis
- Action buttons:
  - Continue to Valuation (primary CTA)
  - Report Incorrect Result (feedback)
  - Back to Identification (navigation)

#### 3. FeedbackModal Component (`apps/web/components/cards/FeedbackModal.tsx`)

- Modal dialog for reporting incorrect authenticity results
- Feedback reason selection:
  - "This card is authentic but marked as fake"
  - "This card is fake but marked as authentic"
  - "The confidence score seems wrong"
  - "Other issue"
- Optional comment textarea for additional details
- Submit handler with loading state
- Success confirmation with toast notification
- Accessible with keyboard navigation and focus management

### Integration Updates

#### Identification Page (`apps/web/app/(protected)/identify/page.tsx`)

- Updated to redirect to `/authenticity` after candidate selection
- Passes selected candidate data via query parameters
- Seamless flow from identification → authenticity

#### Component Exports (`apps/web/components/cards/index.ts`)

- Added exports for AuthenticityBadge and FeedbackModal
- Centralized component exports for cards domain

## User Flow

1. User selects a card candidate on `/identify` page
2. Clicks "Continue with Selection"
3. Redirected to `/authenticity?cardId={id}&name={name}&...`
4. Loading state shown while fetching authenticity data
5. Detailed authenticity analysis displayed with:
   - Overall score badge
   - AI-generated rationale
   - Individual signal breakdowns
   - Visual representations
6. User can:
   - Continue to valuation (next step)
   - Report incorrect results (feedback)
   - Go back to identification

## Technical Details

### Mock Data

Currently uses mock authenticity data for development. Ready for backend API integration when authenticity endpoint is available.

### Color System

Uses CSS custom properties from design system:

- `--emerald-glow`: Authentic (≥80%)
- `--amber-pulse`: Uncertain (50-80%)
- `--crimson-red`: Suspicious (<50%)

### Accessibility Features

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Focus management in modals
- Color-blind friendly (uses icons + text)
- Screen reader announcements

### Responsive Design

- Mobile-first approach
- Stacked layout on mobile
- Side-by-side layout on desktop
- Touch-friendly interactions
- Optimized image display

### Performance

- Lazy-loaded modal component
- Optimized re-renders with React.memo
- Efficient state management
- Image optimization

## Requirements Satisfied

✅ **Requirement 4.1**: Authenticity analysis page created  
✅ **Requirement 4.2**: AuthenticityBadge with score display  
✅ **Requirement 4.3**: Color-coded scoring system  
✅ **Requirement 4.4**: Detailed signal breakdown displayed  
✅ **Requirement 4.5**: Visual representations of metrics  
✅ **Requirement 4.6**: Feedback reporting mechanism  
✅ **Requirement 4.7**: Accessibility compliance

## Testing

- ✅ TypeScript compilation passes
- ✅ No linting errors in new files
- ✅ Components render correctly in all states
- ✅ Modal interactions work as expected
- ✅ Responsive design verified
- ✅ Accessibility features tested
- ✅ Color contrast meets WCAG AA standards

## Screenshots

_Note: Add screenshots of:_

- Authenticity page with high score (green)
- Authenticity page with medium score (yellow)
- Authenticity page with low score (red)
- FeedbackModal open state
- Mobile responsive layout

## API Integration Notes

### Expected Backend Endpoint

```typescript
GET / cards / { cardId } / authenticity;

Response: {
  authenticityScore: number; // 0-1
  fakeDetected: boolean;
  rationale: string;
  signals: {
    visualHashConfidence: number; // 0-1
    textMatchConfidence: number; // 0-1
    holoPatternConfidence: number; // 0-1
  }
  verifiedByAI: boolean;
}
```

### Feedback Endpoint

```typescript
POST /feedback/authenticity

Request:
{
  cardId: string;
  reason: string;
  comment?: string;
}

Response:
{
  success: boolean;
  message: string;
}
```

## Next Steps

1. Backend team to implement authenticity analysis endpoint
2. Replace mock data with actual API calls
3. Implement valuation page (Task 8)
4. Add integration tests for authenticity flow
5. Implement real-time updates for reanalysis
6. Add analytics tracking for feedback submissions

## Dependencies

- Depends on identification flow (Task 6) ✅
- Prerequisite for valuation display (Task 8)
- Uses shared schemas from `@collectiq/shared`

## Related Issues

- Implements Task 7 from `.kiro/specs/collectiq-frontend/tasks.md`
- Follows design system from Task 2
- Integrates with API client from Task 4

## Breaking Changes

None - This is a new feature addition.

## Migration Guide

No migration needed. New routes and components are additive.
