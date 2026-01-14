/**
 * Text cleanup utilities for fixing common paste issues in diagrams.
 */

/**
 * Normalize NBSP, HTML entities, and zero-width characters to regular spaces.
 */
export function normalizeSpaces(s: string): string {
  return s
    .replace(/\u00A0/g, " ") // NBSP
    .replace(/&nbsp;/gi, " ") // HTML entity
    .replace(/&#160;/g, " ") // Numeric entity
    .replace(/&#xA0;/gi, " ") // Hex entity
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, ""); // Zero-width chars
}

/**
 * Normalize smart/curly quotes to straight quotes.
 */
export function normalizeSmartQuotes(s: string): string {
  return s
    .replace(/[\u201C\u201D]/g, '"') // Curly double quotes " "
    .replace(/[\u2018\u2019]/g, "'"); // Curly single quotes ' '
}

/**
 * Apply all text normalization fixes.
 */
export function normalizeText(s: string): string {
  return normalizeSmartQuotes(normalizeSpaces(s));
}
