/**
 * Rendering pipeline with placeholder hydration.
 * 1. Parse markdown -> HTML with placeholders
 * 2. Insert HTML into DOM
 * 3. Hydrate placeholders with async-rendered diagrams/math
 * 4. Generate export HTML (no placeholders, no blob URLs)
 */

import { parseMarkdown } from "../convert/markdownToHtml";
import { renderDiagramToEmbeddedNode } from "./diagrams";
import { renderMathToEmbeddedNode } from "./math";
import { isDiagramPlaceholder, isMathPlaceholder, parsePlaceholderId } from "../core/placeholders";

export type PipelineOptions = {
  previewEl: HTMLElement;
  htmlOutputEl?: HTMLTextAreaElement;
  onRenderStart?: () => void;
  onRenderComplete?: () => void;
  onError?: (error: Error) => void;
};

export type RenderPipeline = {
  render: (md: string) => Promise<void>;
  getExportHtml: () => string;
};

/**
 * Sanitize HTML using DOMPurify if available.
 */
function sanitizeHtml(html: string): string {
  if (window.DOMPurify) {
    return window.DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    });
  }
  return html;
}

/**
 * Create a render pipeline for markdown to HTML conversion.
 */
export function createRenderPipeline(options: PipelineOptions): RenderPipeline {
  const { previewEl, htmlOutputEl, onRenderStart, onRenderComplete, onError } = options;

  let pending = 0;

  async function render(md: string): Promise<void> {
    const token = ++pending;

    function shouldContinue(): boolean {
      return token === pending;
    }

    onRenderStart?.();

    try {
      const text = (md || "").trim();
      if (!text) {
        previewEl.innerHTML = "";
        if (htmlOutputEl) htmlOutputEl.value = "";
        onRenderComplete?.();
        return;
      }

      // Step 1: Parse markdown with placeholder extraction
      const { html, diagrams, math } = parseMarkdown(text);

      if (!shouldContinue()) return;

      // Step 2: Sanitize and insert HTML
      const sanitized = sanitizeHtml(html);
      previewEl.innerHTML = sanitized;

      if (!shouldContinue()) return;

      // Step 3: Hydrate diagram placeholders
      const diagramImgs = Array.from(previewEl.querySelectorAll("img")).filter(
        isDiagramPlaceholder
      );

      for (const img of diagramImgs) {
        if (!shouldContinue()) return;

        const id = parsePlaceholderId(img);
        const record = diagrams.find((d) => d.id === id);
        if (!record) continue;

        const figure = await renderDiagramToEmbeddedNode(record, {
          mdText: text,
          matchIndex: 0,
          token,
        });

        if (!shouldContinue()) return;

        img.parentNode?.replaceChild(figure, img);
      }

      // Step 4: Hydrate math placeholders
      const mathImgs = Array.from(previewEl.querySelectorAll("img")).filter(isMathPlaceholder);

      for (const img of mathImgs) {
        if (!shouldContinue()) return;

        const id = parsePlaceholderId(img);
        const record = math.find((m) => m.id === id);
        if (!record) continue;

        const element = await renderMathToEmbeddedNode(record);

        if (!shouldContinue()) return;

        img.parentNode?.replaceChild(element, img);
      }

      // Step 5: Apply syntax highlighting
      if (window.Prism?.highlightAllUnder) {
        window.Prism.highlightAllUnder(previewEl);
      }

      // Step 6: Update export HTML
      if (htmlOutputEl && shouldContinue()) {
        htmlOutputEl.value = previewEl.innerHTML;
      }

      onRenderComplete?.();
    } catch (error) {
      if (shouldContinue()) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error("Render pipeline error:", err);
        onError?.(err);
      }
    }
  }

  function getExportHtml(): string {
    return previewEl.innerHTML;
  }

  return { render, getExportHtml };
}
