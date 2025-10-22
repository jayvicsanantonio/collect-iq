/**
 * Fuzzy Matching Utility
 *
 * Provides string similarity functions for OCR error correction.
 * Uses Levenshtein distance algorithm for approximate string matching.
 */

/**
 * Calculate Levenshtein distance between two strings
 *
 * The Levenshtein distance is the minimum number of single-character edits
 * (insertions, deletions, or substitutions) required to change one string into another.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns The Levenshtein distance (0 = identical strings)
 *
 * @example
 * levenshteinDistance('kitten', 'sitting') // Returns 3
 * levenshteinDistance('hello', 'hello') // Returns 0
 */
export function levenshteinDistance(str1: string, str2: string): number {
  // Handle edge cases
  if (str1 === str2) return 0;
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  // Create a 2D array for dynamic programming
  const matrix: number[][] = [];

  // Initialize first column (deletion costs)
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row (insertion costs)
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        // Characters match, no operation needed
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        // Take minimum of three operations: insert, delete, substitute
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // Substitution
          matrix[i][j - 1] + 1, // Insertion
          matrix[i - 1][j] + 1 // Deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Normalize string for comparison
 *
 * Converts string to lowercase, trims whitespace, and removes special characters
 * to improve matching accuracy.
 *
 * @param str - String to normalize
 * @returns Normalized string
 *
 * @example
 * normalizeForComparison('  Pikachu! ') // Returns 'pikachu'
 * normalizeForComparison('Mr. Mime') // Returns 'mr mime'
 */
export function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
    .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
}

/**
 * Calculate similarity score between two strings
 *
 * Returns a value between 0.0 (completely different) and 1.0 (identical).
 * Uses normalized Levenshtein distance.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Similarity score (0.0 to 1.0)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeForComparison(str1);
  const normalized2 = normalizeForComparison(str2);

  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  // Avoid division by zero
  if (maxLength === 0) return 1.0;

  // Convert distance to similarity score
  return 1 - distance / maxLength;
}

/**
 * Result of a fuzzy match operation
 */
export interface FuzzyMatchResult {
  /** The matched candidate string */
  match: string;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
}

/**
 * Find best match from a list of candidates
 *
 * Compares input string against all candidates and returns the best match
 * if it exceeds the confidence threshold.
 *
 * @param input - Input string to match
 * @param candidates - Array of candidate strings to match against
 * @param threshold - Minimum confidence score required (default: 0.7)
 * @returns Best match result or null if no match exceeds threshold
 *
 * @example
 * findBestMatch('Yenusaur', ['Venusaur', 'Ivysaur', 'Bulbasaur'], 0.7)
 * // Returns { match: 'Venusaur', confidence: 0.875 }
 *
 * findBestMatch('xyz', ['Venusaur', 'Ivysaur'], 0.7)
 * // Returns null (no match above threshold)
 */
export function findBestMatch(
  input: string,
  candidates: string[],
  threshold: number = 0.7
): FuzzyMatchResult | null {
  // Handle edge cases
  if (!input || input.trim().length === 0) return null;
  if (!candidates || candidates.length === 0) return null;

  let bestMatch: string | null = null;
  let bestConfidence = 0;

  // Compare input against each candidate
  for (const candidate of candidates) {
    if (!candidate || candidate.trim().length === 0) continue;

    const confidence = calculateSimilarity(input, candidate);

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestMatch = candidate;
    }
  }

  // Return best match if it exceeds threshold
  if (bestMatch && bestConfidence >= threshold) {
    return {
      match: bestMatch,
      confidence: bestConfidence,
    };
  }

  return null;
}
