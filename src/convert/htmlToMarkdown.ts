/**
 * HTML to Markdown conversion with custom rules for diagrams and math.
 * Enables round-trip editing: exported HTML can be converted back to markdown
 * with diagram fences and math expressions preserved.
 */

import type { TurndownInstance, TurndownRule } from "../types/vendors";

export type { TurndownInstance, TurndownRule };

/**
 * Create and configure a Turndown service with custom rules.
 */
export function createTurndownService(): TurndownInstance {
  const TurndownService = window.TurndownService;
  if (!TurndownService) {
    throw new Error("TurndownService is not available");
  }

  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Custom rule for embedded diagrams
  td.addRule("diagram", {
    filter: (node: HTMLElement) => {
      return (
        (node.tagName === "FIGURE" || node.tagName === "DIV") &&
        node.hasAttribute("data-diagram") &&
        node.hasAttribute("data-source-base64")
      );
    },
    replacement: (_content: string, node: HTMLElement) => {
      const lang = node.getAttribute("data-diagram") || "mermaid";
      const sourceBase64 = node.getAttribute("data-source-base64") || "";
      try {
        const source = atob(sourceBase64);
        return `\n\`\`\`${lang}\n${source}\n\`\`\`\n`;
      } catch {
        return `\n\`\`\`${lang}\n<!-- Error decoding diagram source -->\n\`\`\`\n`;
      }
    },
  });

  // Custom rule for embedded math
  td.addRule("math", {
    filter: (node: HTMLElement) => {
      return node.classList.contains("math") && node.hasAttribute("data-tex");
    },
    replacement: (_content: string, node: HTMLElement) => {
      const tex = node.getAttribute("data-tex") || "";
      const mode = node.getAttribute("data-math-mode");
      if (mode === "block") {
        return `\n$$\n${tex}\n$$\n`;
      }
      return `$${tex}$`;
    },
  });

  return td;
}

/**
 * Convert HTML to Markdown.
 */
export function htmlToMarkdown(html: string, td?: TurndownInstance): string {
  const service = td || createTurndownService();
  return service.turndown(html);
}

/**
 * Check if text looks like markdown based on common patterns.
 */
export function looksLikeMarkdown(s: string): boolean {
  const t = (s || "").trim();
  if (!t) return false;
  return (
    /(^|\n)\s{0,3}#{1,6}\s+\S/.test(t) || // Headings
    /(^|\n)\s{0,3}[-*+]\s+\S/.test(t) || // Unordered lists
    /(^|\n)\s{0,3}\d+\.\s+\S/.test(t) // Ordered lists
  );
}
