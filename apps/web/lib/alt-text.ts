import type { Card } from '@collectiq/shared';

/**
 * Generate descriptive alt text for card images
 * Follows WCAG guidelines for meaningful image descriptions
 */

/**
 * Generate alt text for a card image
 * Includes card name, set, rarity, and condition when available
 * 
 * @param card - Card object with metadata
 * @returns Descriptive alt text string
 */
export function getCardImageAlt(card: Partial<Card>): string {
  const parts: string[] = [];

  // Card name (required)
  if (card.name) {
    parts.push(card.name);
  } else {
    parts.push('Trading card');
  }

  // Set information
  if (card.set) {
    parts.push(`from ${card.set}`);
    if (card.number) {
      parts.push(`#${card.number}`);
    }
  }

  // Rarity
  if (card.rarity) {
    parts.push(`(${card.rarity})`);
  }

  // Condition
  if (card.conditionEstimate) {
    parts.push(`in ${card.conditionEstimate} condition`);
  }

  return parts.join(' ');
}

/**
 * Generate alt text for a card thumbnail in a grid
 * Shorter version for grid views
 * 
 * @param card - Card object with metadata
 * @returns Short descriptive alt text
 */
export function getCardThumbnailAlt(card: Partial<Card>): string {
  if (card.name && card.set) {
    return `${card.name} from ${card.set}`;
  } else if (card.name) {
    return card.name;
  } else {
    return 'Trading card';
  }
}

/**
 * Generate alt text for decorative images
 * Returns empty string as per WCAG guidelines
 * 
 * @returns Empty string for decorative images
 */
export function getDecorativeImageAlt(): string {
  return '';
}

/**
 * Generate alt text for authenticity badge icons
 * 
 * @param score - Authenticity score (0-1)
 * @returns Descriptive text for screen readers
 */
export function getAuthenticityBadgeAlt(score: number): string {
  const percentage = Math.round(score * 100);
  
  if (score >= 0.8) {
    return `High confidence authentic: ${percentage}% authenticity score`;
  } else if (score >= 0.5) {
    return `Medium confidence, needs review: ${percentage}% authenticity score`;
  } else {
    return `Low confidence, likely fake: ${percentage}% authenticity score`;
  }
}

/**
 * Generate alt text for valuation trend icons
 * 
 * @param direction - Trend direction ('up', 'down', 'stable')
 * @param percentage - Percentage change
 * @returns Descriptive text for screen readers
 */
export function getValuationTrendAlt(
  direction: 'up' | 'down' | 'stable',
  percentage: number
): string {
  const absPercentage = Math.abs(percentage);
  
  if (direction === 'up') {
    return `Value increased by ${absPercentage.toFixed(1)}%`;
  } else if (direction === 'down') {
    return `Value decreased by ${absPercentage.toFixed(1)}%`;
  } else {
    return 'Value stable, no significant change';
  }
}

/**
 * Generate alt text for loading/placeholder images
 * 
 * @returns Descriptive text for loading state
 */
export function getLoadingImageAlt(): string {
  return 'Loading card image';
}

/**
 * Generate alt text for error/missing images
 * 
 * @returns Descriptive text for error state
 */
export function getErrorImageAlt(): string {
  return 'Card image unavailable';
}
