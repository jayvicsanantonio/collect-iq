import type { Card } from '@/lib/types';
import type { ValuationHistoryDataPoint } from '@/components/cards/ValuationHistoryChart';
import type { ComparableSale } from '@/components/cards/MarketDataTable';

/**
 * Mock Charizard card data for development and testing
 * Based on Base Set Charizard #4 - Holo Rare
 */
export const mockCharizardCard: Card = {
  cardId: '550e8400-e29b-41d4-a716-446655440000',
  userId: 'mock-user-123',
  frontS3Key: 'mock/charizard-front.jpg',
  backS3Key: 'mock/charizard-back.jpg',
  name: 'Charizard',
  set: 'Base Set',
  number: '4',
  rarity: 'Holo Rare',
  type: 'Fire',
  imageUrl: 'https://images.pokemontcg.io/base1/4_hires.png',
  
  // Authenticity data - 92% authentic
  authenticityScore: 0.92,
  authenticitySignals: {
    visualHashConfidence: 0.95,
    textMatchConfidence: 0.91,
    holoPatternConfidence: 0.89,
    borderConsistency: 0.93,
    fontValidation: 0.94,
    rationale: 'Card shows strong authenticity indicators. Holographic pattern matches known genuine Base Set Charizard cards. Text clarity and font are consistent with official printing. Border consistency is excellent. Minor wear consistent with age.',
    fakeDetected: false,
  },
  
  // Valuation data - $450 median
  valueLow: 350.0,
  valueMedian: 450.0,
  valueHigh: 600.0,
  conditionEstimate: 'Near Mint',
  
  // Timestamps
  createdAt: '2025-10-12T14:30:00Z',
  updatedAt: '2025-10-18T09:15:00Z',
};

/**
 * Mock valuation history data for Charizard
 * Shows price trends over the last 30 days
 */
export const mockCharizardValuationHistory: ValuationHistoryDataPoint[] = [
  {
    date: '2025-09-18T00:00:00Z',
    low: 320,
    median: 420,
    high: 550,
  },
  {
    date: '2025-09-21T00:00:00Z',
    low: 325,
    median: 425,
    high: 560,
  },
  {
    date: '2025-09-24T00:00:00Z',
    low: 330,
    median: 430,
    high: 570,
  },
  {
    date: '2025-09-27T00:00:00Z',
    low: 335,
    median: 435,
    high: 575,
  },
  {
    date: '2025-09-30T00:00:00Z',
    low: 340,
    median: 440,
    high: 580,
  },
  {
    date: '2025-10-03T00:00:00Z',
    low: 345,
    median: 445,
    high: 590,
  },
  {
    date: '2025-10-06T00:00:00Z',
    low: 348,
    median: 448,
    high: 595,
  },
  {
    date: '2025-10-09T00:00:00Z',
    low: 350,
    median: 450,
    high: 600,
  },
  {
    date: '2025-10-12T00:00:00Z',
    low: 350,
    median: 450,
    high: 600,
  },
  {
    date: '2025-10-15T00:00:00Z',
    low: 350,
    median: 450,
    high: 600,
  },
  {
    date: '2025-10-18T00:00:00Z',
    low: 350,
    median: 450,
    high: 600,
  },
];

/**
 * Mock comparable sales data for Charizard
 * Recent sales from various marketplaces
 */
export const mockCharizardComparableSales: ComparableSale[] = [
  {
    id: 'sale-1',
    source: 'eBay',
    date: '2025-10-17T15:30:00Z',
    price: 475.0,
    condition: 'Near Mint',
    url: 'https://www.ebay.com/itm/example1',
  },
  {
    id: 'sale-2',
    source: 'TCGPlayer',
    date: '2025-10-16T10:20:00Z',
    price: 445.0,
    condition: 'Near Mint',
    url: 'https://www.tcgplayer.com/product/example2',
  },
  {
    id: 'sale-3',
    source: 'eBay',
    date: '2025-10-15T18:45:00Z',
    price: 520.0,
    condition: 'Mint',
    url: 'https://www.ebay.com/itm/example3',
  },
  {
    id: 'sale-4',
    source: 'PriceCharting',
    date: '2025-10-14T12:00:00Z',
    price: 430.0,
    condition: 'Near Mint',
    url: 'https://www.pricecharting.com/game/example4',
  },
  {
    id: 'sale-5',
    source: 'TCGPlayer',
    date: '2025-10-13T09:15:00Z',
    price: 460.0,
    condition: 'Near Mint',
    url: 'https://www.tcgplayer.com/product/example5',
  },
  {
    id: 'sale-6',
    source: 'eBay',
    date: '2025-10-12T16:30:00Z',
    price: 395.0,
    condition: 'Lightly Played',
    url: 'https://www.ebay.com/itm/example6',
  },
  {
    id: 'sale-7',
    source: 'eBay',
    date: '2025-10-11T14:20:00Z',
    price: 485.0,
    condition: 'Near Mint',
    url: 'https://www.ebay.com/itm/example7',
  },
  {
    id: 'sale-8',
    source: 'TCGPlayer',
    date: '2025-10-10T11:45:00Z',
    price: 440.0,
    condition: 'Near Mint',
    url: 'https://www.tcgplayer.com/product/example8',
  },
  {
    id: 'sale-9',
    source: 'PriceCharting',
    date: '2025-10-09T08:30:00Z',
    price: 425.0,
    condition: 'Near Mint',
    url: 'https://www.pricecharting.com/game/example9',
  },
  {
    id: 'sale-10',
    source: 'eBay',
    date: '2025-10-08T19:00:00Z',
    price: 550.0,
    condition: 'Mint',
    url: 'https://www.ebay.com/itm/example10',
  },
];

/**
 * Additional mock cards for testing various scenarios
 */
export const mockCards = {
  charizard: mockCharizardCard,
  
  // Low authenticity card (potential fake)
  suspiciousCard: {
    ...mockCharizardCard,
    cardId: '550e8400-e29b-41d4-a716-446655440001',
    authenticityScore: 0.35,
    authenticitySignals: {
      visualHashConfidence: 0.42,
      textMatchConfidence: 0.31,
      holoPatternConfidence: 0.28,
      borderConsistency: 0.45,
      fontValidation: 0.38,
      rationale: 'Multiple authenticity concerns detected. Holographic pattern does not match known genuine cards. Text appears slightly blurred. Border inconsistencies suggest potential counterfeit.',
      fakeDetected: true,
    },
  } as Card,
  
  // Card without valuation data (recently uploaded)
  processingCard: {
    ...mockCharizardCard,
    cardId: '550e8400-e29b-41d4-a716-446655440002',
    valueLow: null,
    valueMedian: null,
    valueHigh: null,
    authenticityScore: null,
    authenticitySignals: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Card,
};
