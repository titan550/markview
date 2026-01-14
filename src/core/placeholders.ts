/**
 * Placeholder system for async diagram/math rendering.
 * Uses 1x1 transparent GIF as placeholder to preserve markdown structure.
 */

// 1x1 transparent GIF
export const PLACEHOLDER_GIF =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

/**
 * Create a markdown image placeholder for a diagram.
 */
export function diagramPlaceholder(id: string): string {
  return `![diagram:${id}](${PLACEHOLDER_GIF})`;
}

/**
 * Create a markdown image placeholder for math.
 */
export function mathPlaceholder(id: string, mode: "inline" | "block"): string {
  return `![math-${mode}:${id}](${PLACEHOLDER_GIF})`;
}

/**
 * Check if an img element is a diagram placeholder.
 */
export function isDiagramPlaceholder(img: HTMLImageElement): boolean {
  return img.alt?.startsWith("diagram:") ?? false;
}

/**
 * Check if an img element is a math placeholder.
 */
export function isMathPlaceholder(img: HTMLImageElement): boolean {
  return img.alt?.startsWith("math-inline:") || img.alt?.startsWith("math-block:") || false;
}

/**
 * Parse the ID from a placeholder image.
 */
export function parsePlaceholderId(img: HTMLImageElement): string | null {
  const alt = img.alt || "";
  const match = alt.match(/^(?:diagram|math-inline|math-block):(.+)$/);
  return match ? match[1] : null;
}

/**
 * Parse the mode from a math placeholder.
 */
export function parseMathMode(img: HTMLImageElement): "inline" | "block" | null {
  const alt = img.alt || "";
  if (alt.startsWith("math-inline:")) return "inline";
  if (alt.startsWith("math-block:")) return "block";
  return null;
}
