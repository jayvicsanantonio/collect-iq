# Card Components

Components for displaying and interacting with trading card data.

## CardDetail

Full card detail view with image, metadata, authenticity analysis, and valuation information.

### Usage

```tsx
import { CardDetail } from '@/components/cards/CardDetail';

<CardDetail
  card={card}
  onDelete={handleDelete}
  onRevaluate={handleRevaluate}
/>;
```

### Props

```typescript
interface CardDetailProps {
  card: Card;
  onDelete?: (cardId: string) => void;
  onRevaluate?: (cardId: string) => void;
}
```

### Features

- ✅ Card image with zoom functionality
- ✅ Card metadata (name, set, number, rarity, condition)
- ✅ Authenticity analysis with detailed breakdown
- ✅ Market valuation panel
- ✅ Valuation history chart (lazy-loaded)
- ✅ Comparable sales table
- ✅ Action buttons (re-evaluate, share, delete)
- ✅ Feedback modal for user corrections

## AuthenticityBadge

Visual indicator for card authenticity score.

### Usage

```tsx
import { AuthenticityBadge } from '@/components/cards/AuthenticityBadge';

<AuthenticityBadge score={92} size="lg" />;
```

### Props

```typescript
interface AuthenticityBadgeProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}
```

### Score Ranges

- **90-100**: High confidence (green) - "Authentic"
- **70-89**: Medium confidence (yellow) - "Likely Authentic"
- **0-69**: Low confidence (red) - "Potential Fake"

## AIInsights

Displays AI-generated insights about the card.

### Usage

```tsx
import { AIInsights } from '@/components/cards/AIInsights';

<AIInsights
  insights={card.aiInsights}
  authenticityDetails={card.authenticityDetails}
/>;
```

### Features

- Visual hash match percentage
- Text validation score
- Holographic pattern analysis
- Border consistency check
- Font validation
- Overall confidence score

## ValuationPanel

Market valuation display with price range.

### Usage

```tsx
import { ValuationPanel } from '@/components/cards/ValuationPanel';

<ValuationPanel
  lowEstimate={350}
  marketValue={450}
  highEstimate={600}
  currency="USD"
  lastUpdated={new Date()}
/>;
```

### Props

```typescript
interface ValuationPanelProps {
  lowEstimate: number;
  marketValue: number;
  highEstimate: number;
  currency?: string;
  lastUpdated?: Date;
  onRefresh?: () => void;
}
```

## ValuationHistoryChart

Time-series chart showing price history.

### Usage

```tsx
import { ValuationHistoryChart } from '@/components/cards/ValuationHistoryChart';

<ValuationHistoryChart data={valuationHistory} height={300} />;
```

### Props

```typescript
interface ValuationHistoryChartProps {
  data: Array<{
    date: string;
    price: number;
  }>;
  height?: number;
  showGrid?: boolean;
}
```

### Features

- Lazy-loaded for performance
- Responsive design
- Interactive tooltips
- Gradient fill
- Smooth animations

## MarketDataTable

Table of comparable sales from various marketplaces.

### Usage

```tsx
import { MarketDataTable } from '@/components/cards/MarketDataTable';

<MarketDataTable
  sales={comparableSales}
  onSourceClick={handleSourceClick}
/>;
```

### Props

```typescript
interface MarketDataTableProps {
  sales: Array<{
    source: string;
    price: number;
    date: string;
    condition?: string;
    url?: string;
  }>;
  onSourceClick?: (url: string) => void;
}
```

### Features

- Sortable columns
- Source badges (eBay, TCGPlayer, PriceCharting)
- Condition indicators
- External links to listings
- Responsive table design

## CandidateList

List of potential card matches during identification.

### Usage

```tsx
import { CandidateList } from '@/components/cards/CandidateList';

<CandidateList candidates={candidates} onSelect={handleSelect} />;
```

### Props

```typescript
interface CandidateListProps {
  candidates: Candidate[];
  onSelect: (candidate: Candidate) => void;
  selectedId?: string;
}
```

### Features

- Confidence score badges
- Card thumbnails
- Set and number display
- Selectable items
- Loading states

## CardProcessing

Loading state component for card processing.

### Usage

```tsx
import { CardProcessing } from '@/components/cards/CardProcessing';

<CardProcessing stage="identification" progress={45} />;
```

### Props

```typescript
interface CardProcessingProps {
  stage: 'upload' | 'identification' | 'valuation' | 'authenticity';
  progress?: number;
  message?: string;
}
```

### Stages

1. **Upload** - Uploading image to S3
2. **Identification** - Extracting features and matching
3. **Valuation** - Computing market value
4. **Authenticity** - Analyzing authenticity

## FeedbackModal

Modal for users to provide feedback on card data.

### Usage

```tsx
import { FeedbackModal } from '@/components/cards/FeedbackModal';

<FeedbackModal
  isOpen={isOpen}
  onClose={handleClose}
  onSubmit={handleSubmit}
  cardId={card.id}
/>;
```

### Props

```typescript
interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: Feedback) => void;
  cardId: string;
}
```

### Feedback Types

- Incorrect identification
- Wrong valuation
- Authenticity dispute
- Missing data
- Other issues

## Demo Data

Mock data is available for development:

```typescript
import { mockCards } from '@/lib/mock-card-data';

// High authenticity card
const charizard = mockCards.mockCharizardCard;

// Low authenticity card
const suspicious = mockCards.suspiciousCard;

// Processing card
const processing = mockCards.processingCard;
```

## Styling

All card components use the CollectIQ design system:

- **Primary Color**: `var(--vault-blue)` - #3B82F6
- **Accent Color**: `var(--holo-cyan)` - #06B6D4
- **Success**: Green for high authenticity
- **Warning**: Yellow/Amber for medium authenticity
- **Danger**: Red for low authenticity/fake detection

## Accessibility

All components include:

- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader friendly
- Color-blind safe (uses icons + patterns, not just color)
- Responsive design (mobile, tablet, desktop)

## Testing

```bash
# Unit tests
pnpm test components/cards

# E2E tests
pnpm test:e2e cards

# Accessibility tests
pnpm test:a11y cards
```

## Learn More

- [Design System](../development/DESIGN_SYSTEM.md)
- [API Client](../development/API_CLIENT.md)
- [Error Handling](../development/ERROR_HANDLING.md)
