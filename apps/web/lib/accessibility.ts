/**
 * Accessibility utilities for ensuring WCAG compliance
 */

/**
 * Calculate relative luminance of a color
 * Used for contrast ratio calculations
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 * WCAG AAA requires 7:1 for normal text, 4.5:1 for large text
 * @param color1 - First color in hex format (e.g., '#1A73E8')
 * @param color2 - Second color in hex format (e.g., '#FFFFFF')
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);

  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);

  const lum1 = getLuminance(r1, g1, b1);
  const lum2 = getLuminance(r2, g2, b2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color combination meets WCAG AA standards
 * @param foreground - Foreground color in hex format
 * @param background - Background color in hex format
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns Whether the combination meets WCAG AA
 */
export function meetsWCAGAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if a color combination meets WCAG AAA standards
 * @param foreground - Foreground color in hex format
 * @param background - Background color in hex format
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns Whether the combination meets WCAG AAA
 */
export function meetsWCAGAAA(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

/**
 * Get accessible text color (black or white) for a given background
 * @param backgroundColor - Background color in hex format
 * @returns '#000000' or '#FFFFFF' depending on which has better contrast
 */
export function getAccessibleTextColor(backgroundColor: string): string {
  const whiteRatio = getContrastRatio(backgroundColor, '#FFFFFF');
  const blackRatio = getContrastRatio(backgroundColor, '#000000');
  return whiteRatio > blackRatio ? '#FFFFFF' : '#000000';
}

/**
 * Design system color contrast validation
 * Validates that our design system colors meet WCAG AA standards
 */
export const colorContrastValidation = {
  // Primary colors on white background
  vaultBlueOnWhite: getContrastRatio('#1A73E8', '#FFFFFF'), // Should be >= 4.5
  holoCyanOnWhite: getContrastRatio('#00C6FF', '#FFFFFF'), // Should be >= 4.5
  
  // Primary colors on dark background
  vaultBlueOnDark: getContrastRatio('#4A9EFF', '#0A0A0A'), // Should be >= 4.5
  holoCyanOnDark: getContrastRatio('#00C6FF', '#0A0A0A'), // Should be >= 4.5
  
  // Semantic colors
  emeraldGlowOnWhite: getContrastRatio('#00E676', '#FFFFFF'), // Success
  amberPulseOnWhite: getContrastRatio('#FFC400', '#000000'), // Warning (on black for better contrast)
  crimsonRedOnWhite: getContrastRatio('#D32F2F', '#FFFFFF'), // Error
};

/**
 * Validate all design system colors meet WCAG AA
 * Run this in development to ensure accessibility compliance
 */
export function validateDesignSystemColors(): {
  passed: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  
  Object.entries(colorContrastValidation).forEach(([key, ratio]) => {
    if (ratio < 4.5) {
      failures.push(`${key}: ${ratio.toFixed(2)} (requires >= 4.5)`);
    }
  });
  
  return {
    passed: failures.length === 0,
    failures,
  };
}
