/**
 * Diagram-focused autofix for markdown.
 * Fixes common issues in diagram fences without touching other content.
 */

import { normalizeNewlines, scanFencedBlocks } from "./fences";
import { sanitizeMermaidSourceLabels } from "./mermaidSanitize";
import { normalizeText } from "./textFix";

// Diagram languages that support text normalization
const DIAGRAM_LANGS = new Set([
  "mermaid",
  "dot",
  "graphviz",
  "gv",
  "wavedrom",
  "wave",
  "wavejson",
  "vega-lite",
  "vl",
]);

/**
 * Apply autofix to diagram fences in markdown.
 * - For mermaid: normalizes text + sanitizes labels
 * - For other diagrams: normalizes text only
 * - Preserves original fence markers and indentation
 */
export function autofixMarkdownDiagrams(md: string): { fixed: string; changed: boolean } {
  const text = normalizeNewlines(md);
  const blocks = scanFencedBlocks(text);

  if (!blocks.length) {
    return { fixed: md, changed: false };
  }

  let out = "";
  let lastIndex = 0;
  let changed = false;

  for (const block of blocks) {
    // Copy text before this block
    out += text.slice(lastIndex, block.start);

    if (!DIAGRAM_LANGS.has(block.lang)) {
      // Not a diagram, keep as-is
      out += text.slice(block.start, block.end);
      lastIndex = block.end;
      continue;
    }

    let content = block.content;

    if (block.lang === "mermaid") {
      // Apply text normalization before mermaid sanitization
      content = normalizeText(content);

      // Apply mermaid label sanitization
      const isERDiagram = /^\s*erDiagram\b/m.test(content);
      content = sanitizeMermaidSourceLabels(content, {
        lineBreak: "<br/>",
        preserveExisting: true,
        normalizeHtmlEntities: true,
        useNamedColon: true,
        useMarkdownStrings: true,
        wrapEdgeLabels: !isERDiagram,
      });
    } else {
      // For other diagrams, just normalize text
      content = normalizeText(content);
    }

    // Check if content changed
    if (content !== block.content) {
      changed = true;
    }

    // Reconstruct the fence block
    const info = block.info ? " " + block.info : "";
    const hasTrailingNewline = block.end > 0 && text[block.end - 1] === "\n";
    out += `${block.indent}${block.marker}${info}\n${content}\n${block.indent}${block.marker}${hasTrailingNewline ? "\n" : ""}`;
    lastIndex = block.end;
  }

  // Copy remaining text after last block
  out += text.slice(lastIndex);

  return { fixed: out, changed };
}
