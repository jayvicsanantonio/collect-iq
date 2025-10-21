# Card Detail View Demo

This document explains how to view and test the card detail view with mock data.

## Demo Page

A dedicated demo page has been created at `/cards/1` that showcases the full card detail view with mock Charizard data.

### Accessing the Demo

1. Start the development server:
   ```bash
   pnpm web:dev
   ```

2. Navigate to: `http://localhost:3002/cards/1`

### Features Demonstrated

The demo page shows all implemented features:

- ✅ **Card Image** with zoom functionality
- ✅ **Card Metadata** (Name, Set, Number, Rarity, Condition)
- ✅ **Authenticity Analysis** with 92% score and detailed breakdown
  - Visual Hash Match: 95%
  - Text Validation: 91%
  - Holographic Pattern: 89%
  - Border Consistency: 93%
  - Font Validation: 94%
- ✅ **Market Valuation** ($350 - $450 - $600)
- ✅ **Valuation History Chart** showing 30-day price trends
- ✅ **Comparable Sales Table** with 10 recent sales from eBay, TCGPlayer, and PriceCharting
- ✅ **Action Buttons** (Re-evaluate, Share, Delete)

## Mock Data

Mock data is available in `lib/mock-card-data.ts`:

### Available Mock Cards

1. **mockCharizardCard** - Base Set Charizard with high authenticity (92%)
2. **suspiciousCard** - Low authenticity card (35%) showing fake detection
3. **processingCard** - Card without valuation data (simulates processing state)

### Using Mock Data in Development

The CardDetail component automatically shows valuation history and comparable sales for Charizard cards in development mode:

```typescript
// In CardDetail.tsx
if (process.env.NODE_ENV === 'development' && card.name === 'Charizard') {
  // Show mock valuation history and comparable sales
}
```

## Testing Different Scenarios

### 1. High Authenticity Card (Charizard)
- Navigate to `/cards/1`
- Shows green authenticity badge (92%)
- Displays full valuation history chart
- Shows comparable sales table
- Matches the styling of landing and upload pages

### 2. Low Authenticity Card (Potential Fake)
Update the `/cards/1/page.tsx` to use `mockCards.suspiciousCard`:

```typescript
import { mockCards } from '@/lib/mock-card-data';

// In the component
<CardDetail card={mockCards.suspiciousCard} ... />
```

This will show:
- Red authenticity badge (35%)
- "Potential Fake Detected" warning
- Detailed breakdown showing low confidence scores

### 3. Processing Card (No Valuation)
Update the `/cards/1/page.tsx` to use `mockCards.processingCard`:

```typescript
<CardDetail card={mockCards.processingCard} ... />
```

This will show:
- No authenticity data
- "Analysis in Progress" message
- No valuation history or comparable sales

## Real Card Integration

When viewing real cards from the API:

1. Navigate to `/cards/[id]` with an actual card ID
2. The page will fetch real data from the API
3. Valuation history and comparable sales will be hidden until backend support is added
4. All other features work with real data

## Future Enhancements

The following features are ready but waiting for backend support:

- [ ] Historical valuation data endpoint
- [ ] Comparable sales data endpoint
- [ ] Feedback submission endpoint
- [ ] Real-time price updates via WebSocket

## Component Structure

```
CardDetail
├── Action Buttons (Re-evaluate, Share, Delete)
├── Card Image (with zoom)
├── Card Metadata
├── Authenticity Analysis
│   ├── Overall Score Badge
│   └── Detailed Breakdown
├── Market Valuation Panel
├── Valuation History Chart (lazy-loaded)
├── Comparable Sales Table
└── Feedback Modal
```

## Styling

The card detail view uses the CollectIQ design system:

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
