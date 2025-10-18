# Card Identification Interface

## Overview

Implements the card identification interface (Task 6 from collectiq-frontend spec) that allows users to view and select from AI-identified card candidates after uploading an image.

## Changes

### New Components

#### 1. CandidateList Component (`apps/web/components/cards/CandidateList.tsx`)

- Displays top-k card identification results in a list format
- Shows card name, set, rarity, and number for each candidate
- Confidence bar visualization with color coding:
  - Green (≥80%): High confidence
  - Yellow (50-80%): Medium confidence
  - Red (<50%): Low confidence
- Card thumbnail images with fallback placeholder
- Interactive selection with visual feedback (checkmark indicator)
- Loading skeleton state for async operations
- Fully accessible with keyboard navigation and ARIA attributes

#### 2. Identification Page (`apps/web/app/(protected)/identify/page.tsx`)

- New `/identify` route that receives S3 key via query parameter
- Multiple states:
  - **Loading**: Spinner with "Analyzing your card with AI..." message
  - **Success**: Displays candidate list with selection UI
  - **Low Confidence**: Warning banner when top match is <70% confident
  - **No Results**: Helpful message with retry/manual entry options
  - **Error**: Error card with retry and alternative options
- Candidate selection handler with state management
- Action buttons:
  - Continue with Selection (primary CTA)
  - Enter Manually (secondary option)
  - Retry (for re-processing)
  - Back to Upload (navigation)

#### 3. Skeleton Component (`apps/web/components/ui/skeleton.tsx`)

- Reusable loading skeleton component
- Used in CandidateList loading state
- Follows shadcn/ui patterns

### Schema Updates

#### Shared Package (`packages/shared/src/schemas.ts`)

Added new types for card identification:

- `Candidate`: Individual card match with confidence score
- `IdentificationResult`: Container for candidate array and processing metadata

### Integration

#### Upload Page (`apps/web/app/(protected)/upload/page.tsx`)

- Updated to redirect to `/identify?key={s3Key}` after successful upload
- Seamless flow from upload → identification

## User Flow

1. User uploads card image on `/upload` page
2. After successful S3 upload, redirected to `/identify?key={s3Key}`
3. Loading state shown while backend processes image
4. Candidates displayed with confidence scores
5. User selects correct card from list
6. Continues to next step (authenticity/valuation)

## Technical Details

### Mock Data

Currently uses mock data for development. Ready for backend API integration when identification endpoint is available.

### Accessibility

- Keyboard navigation support (Enter/Space to select cards)
- ARIA labels and roles for screen readers
- Semantic HTML structure
- Focus management

### Responsive Design

- Mobile-first approach
- Flexible layouts that adapt to screen size
- Touch-friendly tap targets

### Error Handling

- Graceful error states with actionable options
- Toast notifications for user feedback
- Retry mechanisms for transient failures

## Requirements Satisfied

✅ **Requirement 3.1**: Card identification candidates displayed  
✅ **Requirement 3.2**: Top-k results with confidence scores  
✅ **Requirement 3.3**: Card metadata (name, set, rarity) shown  
✅ **Requirement 3.4**: Manual confirmation option for low confidence  
✅ **Requirement 3.5**: Error handling with retry options  
✅ **Requirement 3.6**: Manual entry fallback option

## Testing

- ✅ TypeScript compilation passes
- ✅ No linting errors in new files
- ✅ Component renders correctly in all states
- ✅ Keyboard navigation works as expected
- ✅ Responsive design verified

## Screenshots

_Note: Add screenshots of the identification page in different states (loading, success, low confidence, error, no results)_

## Next Steps

1. Backend team to implement `/identify` API endpoint
2. Replace mock data with actual API call
3. Implement manual entry form
4. Add integration tests
5. Connect to authenticity/valuation flow (next task)

## Related Issues

- Implements Task 6 from `.kiro/specs/collectiq-frontend/tasks.md`
- Depends on upload flow (Task 5)
- Prerequisite for authenticity display (Task 7)
