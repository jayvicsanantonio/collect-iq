import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  normalizeForComparison,
  findBestMatch,
} from '../utils/fuzzy-matching';

describe('Fuzzy Matching Utility', () => {
  describe('levenshteinDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('Pikachu', 'Pikachu')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('should calculate distance for single character differences', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1); // Substitution
      expect(levenshteinDistance('cat', 'cats')).toBe(1); // Insertion
      expect(levenshteinDistance('cats', 'cat')).toBe(1); // Deletion
    });

    it('should calculate distance for multiple character differences', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('Yenusaur', 'Venusaur')).toBe(1);
      expect(levenshteinDistance('Pikachu', 'Raichu')).toBe(4);
    });

    it('should handle empty strings', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    it('should be case-sensitive', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(1);
      expect(levenshteinDistance('PIKACHU', 'pikachu')).toBe(7);
    });

    it('should handle special characters', () => {
      expect(levenshteinDistance('Mr. Mime', 'Mr Mime')).toBe(1);
      expect(levenshteinDistance("Farfetch'd", 'Farfetchd')).toBe(1);
    });
  });

  describe('normalizeForComparison', () => {
    it('should convert to lowercase', () => {
      expect(normalizeForComparison('PIKACHU')).toBe('pikachu');
      expect(normalizeForComparison('Charizard')).toBe('charizard');
    });

    it('should trim whitespace', () => {
      expect(normalizeForComparison('  Pikachu  ')).toBe('pikachu');
      expect(normalizeForComparison('\tVenusaur\n')).toBe('venusaur');
    });

    it('should remove special characters', () => {
      expect(normalizeForComparison('Mr. Mime')).toBe('mr mime');
      expect(normalizeForComparison("Farfetch'd")).toBe('farfetchd');
      expect(normalizeForComparison('Pikachu!')).toBe('pikachu');
      expect(normalizeForComparison('Type: Null')).toBe('type null');
    });

    it('should normalize multiple spaces', () => {
      expect(normalizeForComparison('Mr.   Mime')).toBe('mr mime');
      expect(normalizeForComparison('Ho-Oh   EX')).toBe('hooh ex');
    });

    it('should handle empty strings', () => {
      expect(normalizeForComparison('')).toBe('');
      expect(normalizeForComparison('   ')).toBe('');
    });

    it('should preserve alphanumeric characters', () => {
      expect(normalizeForComparison('Mewtwo EX')).toBe('mewtwo ex');
      expect(normalizeForComparison('Porygon2')).toBe('porygon2');
    });
  });

  describe('findBestMatch', () => {
    const pokemonNames = [
      'Venusaur',
      'Charizard',
      'Blastoise',
      'Pikachu',
      'Raichu',
      'Mewtwo',
      'Mew',
    ];

    it('should find exact matches with high confidence', () => {
      const result = findBestMatch('Pikachu', pokemonNames);
      expect(result).not.toBeNull();
      expect(result?.match).toBe('Pikachu');
      expect(result?.confidence).toBe(1.0);
    });

    it('should find close matches with OCR errors', () => {
      const result = findBestMatch('Yenusaur', pokemonNames);
      expect(result).not.toBeNull();
      expect(result?.match).toBe('Venusaur');
      expect(result?.confidence).toBeGreaterThan(0.7);
    });

    it('should handle case-insensitive matching', () => {
      const result = findBestMatch('CHARIZARD', pokemonNames);
      expect(result).not.toBeNull();
      expect(result?.match).toBe('Charizard');
      expect(result?.confidence).toBe(1.0);
    });

    it('should return null when no match exceeds threshold', () => {
      const result = findBestMatch('xyz', pokemonNames, 0.7);
      expect(result).toBeNull();
    });

    it('should respect custom threshold', () => {
      // With high threshold, minor differences should fail
      const result = findBestMatch('Pikach', pokemonNames, 0.95);
      expect(result).toBeNull();

      // With low threshold, it should match
      const result2 = findBestMatch('Pikach', pokemonNames, 0.8);
      expect(result2).not.toBeNull();
      expect(result2?.match).toBe('Pikachu');
    });

    it('should handle empty input', () => {
      expect(findBestMatch('', pokemonNames)).toBeNull();
      expect(findBestMatch('   ', pokemonNames)).toBeNull();
    });

    it('should handle empty candidates array', () => {
      expect(findBestMatch('Pikachu', [])).toBeNull();
    });

    it('should handle candidates with empty strings', () => {
      const candidates = ['', 'Pikachu', '', 'Charizard'];
      const result = findBestMatch('Pikachu', candidates);
      expect(result).not.toBeNull();
      expect(result?.match).toBe('Pikachu');
    });

    it('should find best match among similar candidates', () => {
      const result = findBestMatch('Raichu', pokemonNames);
      expect(result).not.toBeNull();
      expect(result?.match).toBe('Raichu');
      // Should prefer Raichu over Pikachu despite both being similar
    });

    it('should handle special characters in input', () => {
      const candidates = ['Mr. Mime', "Farfetch'd", 'Type: Null'];
      const result = findBestMatch('Mr Mime', candidates);
      expect(result).not.toBeNull();
      expect(result?.match).toBe('Mr. Mime');
    });

    it('should return confidence score between 0 and 1', () => {
      const result = findBestMatch('Pikach', pokemonNames, 0.5);
      expect(result).not.toBeNull();
      expect(result?.confidence).toBeGreaterThanOrEqual(0);
      expect(result?.confidence).toBeLessThanOrEqual(1);
    });
  });
});
