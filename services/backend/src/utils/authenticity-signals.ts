/**
 * Authenticity Signals Computation
 * Calculates various confidence signals for card authenticity detection
 */

import type { FeatureEnvelope, AuthenticitySignals, OCRBlock } from '@collectiq/shared';
import { logger } from './logger.js';

/**
 * Known authentic card text patterns
 * These are common text elements found on authentic Pokémon cards
 */
const AUTHENTIC_TEXT_PATTERNS = [
  'HP',
  '©',
  'Pokémon',
  'Nintendo',
  'Creatures',
  'GAME FREAK',
  'Illus.',
  'Weakness',
  'Resistance',
  'Retreat',
];

/**
 * Expected font characteristics for authentic cards
 */
const AUTHENTIC_FONT_CHARACTERISTICS = {
  minAlignment: 0.7, // Minimum alignment score for authentic cards
  maxKerningVariance: 0.05, // Maximum variance in kerning
  maxFontSizeVariance: 50, // Maximum variance in font sizes
};

/**
 * Expected border characteristics for authentic cards
 */
const AUTHENTIC_BORDER_CHARACTERISTICS = {
  minSymmetry: 0.8, // Minimum symmetry score
  expectedBorderRatio: 0.15, // Expected border ratio (normalized)
  borderTolerance: 0.1, // Tolerance for border ratio deviation
};

/**
 * Expected holographic characteristics
 */
const AUTHENTIC_HOLO_CHARACTERISTICS = {
  minVariance: 0.3, // Minimum variance for holographic cards
  maxVariance: 0.9, // Maximum variance (too high might indicate tampering)
};

/**
 * Calculate text match confidence from OCR validation
 * Checks if expected text patterns are present and correctly formatted
 *
 * @param ocrBlocks - OCR blocks extracted from the card image
 * @param expectedCardName - Expected card name (optional)
 * @returns Confidence score (0-1)
 */
export function calculateTextMatchConfidence(
  ocrBlocks: OCRBlock[],
  expectedCardName?: string,
): number {
  if (ocrBlocks.length === 0) {
    logger.warn('No OCR blocks provided for text match confidence');
    return 0;
  }

  logger.debug('Calculating text match confidence', {
    blockCount: ocrBlocks.length,
    expectedCardName,
  });

  // Extract all text from OCR blocks
  const allText = ocrBlocks.map((block) => block.text).join(' ');
  const allTextLower = allText.toLowerCase();

  let matchScore = 0;
  let totalChecks = 0;

  // Check for authentic text patterns
  for (const pattern of AUTHENTIC_TEXT_PATTERNS) {
    totalChecks++;
    if (allTextLower.includes(pattern.toLowerCase())) {
      matchScore++;
    }
  }

  // Check for expected card name if provided
  if (expectedCardName) {
    totalChecks++;
    const cardNameLower = expectedCardName.toLowerCase();
    if (allTextLower.includes(cardNameLower)) {
      matchScore++;
    }
  }

  // Calculate average OCR confidence
  const avgOcrConfidence =
    ocrBlocks.reduce((sum, block) => sum + block.confidence, 0) / ocrBlocks.length;

  // Combine pattern matching with OCR confidence
  const patternMatchRatio = matchScore / totalChecks;
  const textMatchConfidence = patternMatchRatio * 0.7 + avgOcrConfidence * 0.3;

  logger.debug('Text match confidence calculated', {
    patternMatchRatio,
    avgOcrConfidence,
    textMatchConfidence,
    matchedPatterns: matchScore,
    totalChecks,
  });

  return Math.min(1, Math.max(0, textMatchConfidence));
}

/**
 * Calculate holographic pattern confidence
 * Analyzes holographic variance to determine authenticity
 *
 * @param holoVariance - Holographic variance from feature extraction
 * @param expectedHolo - Whether the card is expected to be holographic
 * @returns Confidence score (0-1)
 */
export function calculateHoloPatternConfidence(
  holoVariance: number,
  expectedHolo: boolean = false,
): number {
  logger.debug('Calculating holo pattern confidence', {
    holoVariance,
    expectedHolo,
  });

  if (!expectedHolo) {
    // For non-holo cards, low variance is expected
    // High variance might indicate fake holographic overlay
    if (holoVariance < 0.2) {
      return 1.0; // Good - low variance as expected
    } else if (holoVariance < 0.4) {
      return 0.7; // Acceptable
    } else {
      return 0.3; // Suspicious - unexpected holographic patterns
    }
  }

  // For holographic cards, variance should be within expected range
  if (
    holoVariance >= AUTHENTIC_HOLO_CHARACTERISTICS.minVariance &&
    holoVariance <= AUTHENTIC_HOLO_CHARACTERISTICS.maxVariance
  ) {
    // Within expected range - calculate confidence based on how centered it is
    const optimalVariance = 0.6; // Optimal variance for authentic holo
    const deviation = Math.abs(holoVariance - optimalVariance);
    const confidence = 1 - deviation / 0.3; // Normalize deviation

    logger.debug('Holo pattern confidence calculated (holo card)', {
      holoVariance,
      confidence: Math.max(0.5, confidence),
    });

    return Math.max(0.5, Math.min(1, confidence));
  } else if (holoVariance < AUTHENTIC_HOLO_CHARACTERISTICS.minVariance) {
    // Too low - might be fake or poor quality scan
    const confidence = 0.3 + (holoVariance / AUTHENTIC_HOLO_CHARACTERISTICS.minVariance) * 0.2;

    logger.debug('Holo pattern confidence calculated (low variance)', {
      holoVariance,
      confidence,
    });

    return confidence;
  } else {
    // Too high - might indicate tampering or poor quality
    const excessVariance = holoVariance - AUTHENTIC_HOLO_CHARACTERISTICS.maxVariance;
    const confidence = Math.max(0.2, 0.5 - excessVariance);

    logger.debug('Holo pattern confidence calculated (high variance)', {
      holoVariance,
      confidence,
    });

    return confidence;
  }
}

/**
 * Calculate border consistency confidence
 * Analyzes border metrics to determine authenticity
 *
 * @param borders - Border metrics from feature extraction
 * @returns Confidence score (0-1)
 */
export function calculateBorderConsistency(borders: FeatureEnvelope['borders']): number {
  logger.debug('Calculating border consistency', { borders });

  // Check symmetry score
  const symmetryConfidence = borders.symmetryScore;

  // Check if border ratios are within expected range
  const borderRatios = [
    borders.topRatio,
    borders.bottomRatio,
    borders.leftRatio,
    borders.rightRatio,
  ];

  const avgBorderRatio = borderRatios.reduce((sum, ratio) => sum + ratio, 0) / borderRatios.length;

  // Calculate variance in border ratios
  const borderVariance =
    borderRatios.reduce((sum, ratio) => sum + Math.pow(ratio - avgBorderRatio, 2), 0) /
    borderRatios.length;

  // Low variance is good (consistent borders)
  const varianceConfidence = Math.max(0, 1 - borderVariance * 10);

  // Check if average border ratio is within expected range
  const expectedRatio = AUTHENTIC_BORDER_CHARACTERISTICS.expectedBorderRatio;
  const tolerance = AUTHENTIC_BORDER_CHARACTERISTICS.borderTolerance;
  const ratioDeviation = Math.abs(avgBorderRatio - expectedRatio);

  let ratioConfidence = 1.0;
  if (ratioDeviation > tolerance) {
    ratioConfidence = Math.max(0, 1 - (ratioDeviation - tolerance) / expectedRatio);
  }

  // Combine all factors
  const borderConsistency =
    symmetryConfidence * 0.4 + varianceConfidence * 0.3 + ratioConfidence * 0.3;

  logger.debug('Border consistency calculated', {
    symmetryConfidence,
    varianceConfidence,
    ratioConfidence,
    borderConsistency,
  });

  return Math.min(1, Math.max(0, borderConsistency));
}

/**
 * Calculate font validation confidence
 * Analyzes font metrics to determine authenticity
 *
 * @param fontMetrics - Font metrics from feature extraction
 * @returns Confidence score (0-1)
 */
export function calculateFontValidation(fontMetrics: FeatureEnvelope['fontMetrics']): number {
  logger.debug('Calculating font validation', { fontMetrics });

  // Check alignment score
  const alignmentConfidence = fontMetrics.alignment;

  // Check kerning consistency
  let kerningConfidence = 1.0;
  if (fontMetrics.kerning.length > 1) {
    const avgKerning =
      fontMetrics.kerning.reduce((sum, k) => sum + k, 0) / fontMetrics.kerning.length;
    const kerningVariance =
      fontMetrics.kerning.reduce((sum, k) => sum + Math.pow(k - avgKerning, 2), 0) /
      fontMetrics.kerning.length;

    // Normalize variance (lower is better)
    kerningConfidence = Math.max(
      0,
      1 - kerningVariance / AUTHENTIC_FONT_CHARACTERISTICS.maxKerningVariance,
    );
  }

  // Check font size variance
  const fontSizeConfidence = Math.max(
    0,
    1 - fontMetrics.fontSizeVariance / AUTHENTIC_FONT_CHARACTERISTICS.maxFontSizeVariance,
  );

  // Combine all factors
  const fontValidation =
    alignmentConfidence * 0.4 + kerningConfidence * 0.3 + fontSizeConfidence * 0.3;

  logger.debug('Font validation calculated', {
    alignmentConfidence,
    kerningConfidence,
    fontSizeConfidence,
    fontValidation,
  });

  return Math.min(1, Math.max(0, fontValidation));
}

/**
 * Compute all authenticity signals from feature envelope
 * Aggregates all signal calculations into a single structure
 *
 * @param features - Feature envelope from Rekognition extraction
 * @param visualHashConfidence - Visual hash confidence from reference comparison
 * @param expectedCardName - Expected card name (optional)
 * @param expectedHolo - Whether the card is expected to be holographic (optional)
 * @returns Complete authenticity signals
 */
export function computeAuthenticitySignals(
  features: FeatureEnvelope,
  visualHashConfidence: number,
  expectedCardName?: string,
  expectedHolo?: boolean,
): AuthenticitySignals {
  logger.info('Computing authenticity signals', {
    expectedCardName,
    expectedHolo,
    visualHashConfidence,
  });

  const signals: AuthenticitySignals = {
    visualHashConfidence,
    textMatchConfidence: calculateTextMatchConfidence(features.ocr, expectedCardName),
    holoPatternConfidence: calculateHoloPatternConfidence(features.holoVariance, expectedHolo),
    borderConsistency: calculateBorderConsistency(features.borders),
    fontValidation: calculateFontValidation(features.fontMetrics),
  };

  logger.info('Authenticity signals computed', signals);

  return signals;
}

/**
 * Calculate overall authenticity score from signals
 * Weighted average of all signals
 *
 * @param signals - Authenticity signals
 * @returns Overall authenticity score (0-1)
 */
export function calculateOverallAuthenticityScore(signals: AuthenticitySignals): number {
  // Weighted average of all signals
  const weights = {
    visualHashConfidence: 0.3,
    textMatchConfidence: 0.25,
    holoPatternConfidence: 0.2,
    borderConsistency: 0.15,
    fontValidation: 0.1,
  };

  const score =
    signals.visualHashConfidence * weights.visualHashConfidence +
    signals.textMatchConfidence * weights.textMatchConfidence +
    signals.holoPatternConfidence * weights.holoPatternConfidence +
    signals.borderConsistency * weights.borderConsistency +
    signals.fontValidation * weights.fontValidation;

  logger.debug('Overall authenticity score calculated', { score, signals });

  return Math.min(1, Math.max(0, score));
}
