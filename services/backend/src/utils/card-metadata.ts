/**
 * Card Metadata Utilities
 * Shared utilities for extracting and processing card metadata from OCR reasoning results
 */

/**
 * Card metadata structure from agents
 */
export interface CardMeta {
  name?: string;
  set?: string;
  number?: string;
  rarity?: string;
  frontS3Key?: string;
  backS3Key?: string;
  conditionEstimate?: string;
  // Enriched metadata from OCR reasoning agent
  ocrMetadata?: {
    name?: { value: string | null; confidence: number; rationale: string };
    rarity?: { value: string | null; confidence: number; rationale: string };
    set?:
      | { value: string | null; confidence: number; rationale: string }
      | {
          value: string | null;
          candidates: Array<{ value: string; confidence: number }>;
          rationale: string;
        };
    collectorNumber?: { value: string | null; confidence: number; rationale: string };
    overallConfidence?: number;
    reasoningTrail?: string;
    verifiedByAI?: boolean;
  };
}

/**
 * Card identifiers extracted from metadata
 */
export interface CardIdentifiers {
  cardName: string;
  set: string;
  rarity?: string;
  collectorNumber?: string;
}

/**
 * Card identifiers with confidence scores
 */
export interface CardIdentifiersWithConfidence extends CardIdentifiers {
  nameConfidence?: number;
  setConfidence?: number;
  rarityConfidence?: number;
  overallConfidence?: number;
  verifiedByAI?: boolean;
}

/**
 * Extract card identifiers from CardMeta, prioritizing OCR reasoning metadata
 *
 * This utility handles both enriched OCR metadata and legacy metadata formats,
 * including multi-candidate set results from the OCR reasoning agent.
 *
 * @param cardMeta - Card metadata from Rekognition or OCR reasoning
 * @returns Card identifiers with fallback to legacy fields
 */
export function getCardIdentifiers(cardMeta: CardMeta): CardIdentifiers {
  if (cardMeta.ocrMetadata) {
    // Use enriched metadata from OCR reasoning agent
    const cardName = cardMeta.ocrMetadata.name?.value || cardMeta.name || 'Unknown Card';
    const rarity = cardMeta.ocrMetadata.rarity?.value || cardMeta.rarity;
    const collectorNumber = cardMeta.ocrMetadata.collectorNumber?.value || cardMeta.number;

    // Handle both single-value and multi-candidate set results
    let set: string;
    if (cardMeta.ocrMetadata.set) {
      if (
        'candidates' in cardMeta.ocrMetadata.set &&
        cardMeta.ocrMetadata.set.candidates?.length > 0
      ) {
        // Use the highest confidence candidate
        set = cardMeta.ocrMetadata.set.candidates[0].value;
      } else {
        set = cardMeta.ocrMetadata.set.value || cardMeta.set || '';
      }
    } else {
      set = cardMeta.set || '';
    }

    return {
      cardName,
      set,
      rarity,
      collectorNumber,
    };
  }

  // Fallback to legacy metadata (for backward compatibility)
  return {
    cardName: cardMeta.name || 'Unknown Card',
    set: cardMeta.set || '',
    rarity: cardMeta.rarity,
    collectorNumber: cardMeta.number,
  };
}

/**
 * Extract card identifiers with confidence scores from CardMeta
 *
 * This extended version includes confidence scores and AI verification status
 * for monitoring and debugging purposes.
 *
 * @param cardMeta - Card metadata from Rekognition or OCR reasoning
 * @returns Card identifiers with confidence scores
 */
export function getCardIdentifiersWithConfidence(
  cardMeta: CardMeta
): CardIdentifiersWithConfidence {
  const identifiers = getCardIdentifiers(cardMeta);

  if (cardMeta.ocrMetadata) {
    // Extract confidence scores from OCR metadata
    let setConfidence: number | undefined;
    if (cardMeta.ocrMetadata.set) {
      if ('candidates' in cardMeta.ocrMetadata.set) {
        setConfidence = cardMeta.ocrMetadata.set.candidates?.[0]?.confidence;
      } else {
        setConfidence = cardMeta.ocrMetadata.set.confidence;
      }
    }

    return {
      ...identifiers,
      nameConfidence: cardMeta.ocrMetadata.name?.confidence,
      setConfidence,
      rarityConfidence: cardMeta.ocrMetadata.rarity?.confidence,
      overallConfidence: cardMeta.ocrMetadata.overallConfidence,
      verifiedByAI: cardMeta.ocrMetadata.verifiedByAI,
    };
  }

  // No confidence scores available for legacy metadata
  return identifiers;
}
