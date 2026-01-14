/**
 * Markdown to HTML conversion with diagram and math extraction.
 * Uses markdown-it for parsing and placeholder substitution for async rendering.
 */

import { normalizeNewlines, scanFencedBlocks, isFenceClosing, parseFenceOpening } from "../core/fences";
import { diagramPlaceholder, mathPlaceholder } from "../core/placeholders";

export type DiagramRecord = {
  id: string;
  lang: string;
  content: string;
  hint?: string;
};

export type MathRecord = {
  id: string;
  mode: "inline" | "block";
  tex: string;
};

export type ParseResult = {
  html: string;
  diagrams: DiagramRecord[];
  math: MathRecord[];
};

// Diagram languages
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
 * Check if inline math expression should be rendered.
 * Filters out currency-like patterns to avoid false positives.
 */
export function shouldRenderInlineMath(expr: string): boolean {
  const trimmed = (expr || "").trim();
  if (!trimmed) return false;

  // Skip currency-like patterns
  const currencyLike =
    /^\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|bn|mm|t))?(?:\s*(?:usd|eur|gbp|cad|aud|jpy|inr))?(?:\s*(?:to|–|-)\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:k|m|b|bn|mm|t))?(?:\s*(?:usd|eur|gbp|cad|aud|jpy|inr))?)?$/i;
  if (currencyLike.test(trimmed)) return false;

  // Render if contains math-like characters
  if (/[\\^_{}=]/.test(trimmed)) return true;
  return /[A-Za-z]/.test(trimmed);
}

/**
 * Extract diagrams from markdown, replacing them with placeholders.
 */
function extractDiagrams(md: string): { mdOut: string; diagrams: DiagramRecord[] } {
  const text = normalizeNewlines(md);
  const blocks = scanFencedBlocks(text);
  const diagrams: DiagramRecord[] = [];

  if (!blocks.length) {
    return { mdOut: text, diagrams };
  }

  let out = "";
  let lastIndex = 0;
  let diagramId = 0;

  for (const block of blocks) {
    out += text.slice(lastIndex, block.start);

    if (DIAGRAM_LANGS.has(block.lang)) {
      const id = String(diagramId++);
      diagrams.push({
        id,
        lang: block.lang,
        content: block.content,
        hint: block.hint,
      });
      // Replace with placeholder (preserve indentation)
      out += `${block.indent}${diagramPlaceholder(id)}\n`;
    } else {
      // Keep non-diagram fences as-is
      out += text.slice(block.start, block.end);
    }
    lastIndex = block.end;
  }

  out += text.slice(lastIndex);
  return { mdOut: out, diagrams };
}

/**
 * Extract math expressions from markdown, replacing them with placeholders.
 * Handles both block ($$...$$) and inline ($...$) math.
 */
function extractMath(md: string): { mdOut: string; math: MathRecord[] } {
  const text = md;
  const math: MathRecord[] = [];
  let out = "";
  let i = 0;
  let mathId = 0;

  // Track fences to skip math inside code blocks
  let inFence = false;
  let fenceMarkerChar: "`" | "~" | null = null;
  let fenceMarkerLen = 0;
  let inInlineCode = false;
  let inlineCodeTicks = 0;

  function isLineStart(pos: number): boolean {
    return pos === 0 || text[pos - 1] === "\n";
  }

  function readLine(pos: number): { text: string; end: number } {
    const end = text.indexOf("\n", pos);
    return {
      text: end === -1 ? text.slice(pos) : text.slice(pos, end),
      end: end === -1 ? text.length : end + 1,
    };
  }

  function countTickRun(pos: number): number {
    let n = 0;
    while (text[pos + n] === "`") n += 1;
    return n;
  }

  function findClosingDollar(start: number, isDouble: boolean): number {
    const needle = isDouble ? "$$" : "$";
    for (let pos = start; pos < text.length; pos++) {
      if (text[pos] === "\\") {
        pos += 1;
        continue;
      }
      if (text.startsWith(needle, pos)) return pos;
    }
    return -1;
  }

  while (i < text.length) {
    const lineInfo = isLineStart(i) ? readLine(i) : null;
    if (lineInfo && !inInlineCode) {
      const lineHasNewline = lineInfo.end <= text.length && text[lineInfo.end - 1] === "\n";
      if (!inFence) {
        const opening = parseFenceOpening(lineInfo.text);
        if (opening) {
          inFence = true;
          fenceMarkerChar = opening.markerChar;
          fenceMarkerLen = opening.markerLen;
          out += lineInfo.text + (lineHasNewline ? "\n" : "");
          i = lineInfo.end;
          continue;
        }
      } else if (fenceMarkerChar && isFenceClosing(lineInfo.text, fenceMarkerChar, fenceMarkerLen)) {
        inFence = false;
        fenceMarkerChar = null;
        fenceMarkerLen = 0;
        out += lineInfo.text + (lineHasNewline ? "\n" : "");
        i = lineInfo.end;
        continue;
      } else if (inFence) {
        out += lineInfo.text + (lineHasNewline ? "\n" : "");
        i = lineInfo.end;
        continue;
      }
    }

    // Track inline code
    if (text[i] === "`") {
      const run = countTickRun(i);
      if (!inInlineCode) {
        inInlineCode = true;
        inlineCodeTicks = run;
      } else if (run >= inlineCodeTicks) {
        inInlineCode = false;
        inlineCodeTicks = 0;
      }
      out += text.slice(i, i + run);
      i += run;
      continue;
    }

    if (inFence || inInlineCode) {
      out += text[i++];
      continue;
    }

    // Block math: $$...$$
    if (text.startsWith("$$", i)) {
      const end = findClosingDollar(i + 2, true);
      if (end === -1) {
        out += text[i++];
        continue;
      }
      const expr = text.slice(i + 2, end).trim();
      if (expr) {
        const id = String(mathId++);
        math.push({ id, mode: "block", tex: expr });
        out += mathPlaceholder(id, "block");
      } else {
        out += text.slice(i, end + 2);
      }
      i = end + 2;
      continue;
    }

    // Inline math: $...$
    if (text[i] === "$" && text[i + 1] !== "$") {
      const end = findClosingDollar(i + 1, false);
      if (end === -1) {
        out += text[i++];
        continue;
      }
      const expr = text.slice(i + 1, end);
      if (shouldRenderInlineMath(expr)) {
        const id = String(mathId++);
        math.push({ id, mode: "inline", tex: expr });
        out += mathPlaceholder(id, "inline");
      } else {
        out += text.slice(i, end + 1);
      }
      i = end + 1;
      continue;
    }

    out += text[i++];
  }

  return { mdOut: out, math };
}

/**
 * Parse markdown and return HTML with diagram/math placeholders.
 */
export function parseMarkdown(md: string): ParseResult {
  const normalized = normalizeNewlines(md);

  // Step 1: Extract diagrams
  const { mdOut: afterDiagrams, diagrams } = extractDiagrams(normalized);

  // Step 2: Extract math
  const { mdOut: afterMath, math } = extractMath(afterDiagrams);

  // Step 3: Render to HTML using markdown-it
  const markdownit = window.markdownit;
  if (!markdownit) {
    throw new Error("markdown-it is not available");
  }

  const mdit = markdownit({
    html: false, // Security: disable raw HTML
    linkify: true,
    typographer: false,
  });

  const html = mdit.render(afterMath);

  return { html, diagrams, math };
}
