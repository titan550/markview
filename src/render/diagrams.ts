/**
 * Diagram rendering to embedded HTML elements with data URLs.
 * No blob URLs - all diagrams are embedded for portability.
 */

import { sanitizeSvgForXml } from "../core/svgSanitize";
import { svgToDataUrl, parseSvgSize } from "../core/svg";
import { mermaidRenderer } from "../renderers/mermaid";
import { dotRenderer } from "../renderers/dot";
import { wavedromRenderer } from "../renderers/wavedrom";
import { vegaLiteRenderer } from "../renderers/vegaLite";
import type { Renderer, RenderContext } from "../renderers/types";
import type { DiagramRecord } from "../convert/markdownToHtml";

// Map of supported diagram languages to their renderers
const renderers: Record<string, Renderer> = {
  mermaid: mermaidRenderer,
  dot: dotRenderer,
  graphviz: dotRenderer,
  gv: dotRenderer,
  wavedrom: wavedromRenderer,
  wave: wavedromRenderer,
  wavejson: wavedromRenderer,
  "vega-lite": vegaLiteRenderer,
  vl: vegaLiteRenderer,
};

// Canonical language names for data attributes
const canonicalLang: Record<string, string> = {
  graphviz: "dot",
  gv: "dot",
  wave: "wavedrom",
  wavejson: "wavedrom",
  vl: "vega-lite",
};

/**
 * Sanitize SVG for security.
 * Removes potentially dangerous elements and attributes.
 */
function sanitizeSvg(svg: string): string {
  // First, fix XML entities
  let result = sanitizeSvgForXml(svg);

  // Use DOMPurify if available for additional security
  if (window.DOMPurify) {
    result = window.DOMPurify.sanitize(result, {
      USE_PROFILES: { svg: true },
      ADD_TAGS: [
        "use",
        "foreignObject",
        "div",
        "span",
        "p",
        "br",
        "strong",
        "em",
        "b",
        "i",
        "ul",
        "ol",
        "li",
      ],
      ADD_ATTR: ["xlink:href", "xmlns", "requiredExtensions"],
    });
  }

  return result;
}

/**
 * Render a diagram to an embedded HTML element.
 * Returns a <figure> element with:
 * - data-diagram: canonical language name
 * - data-source-base64: base64-encoded original source for round-trip
 * - embedded <img> with data URL
 */
export async function renderDiagramToEmbeddedNode(
  diagram: DiagramRecord,
  ctx: RenderContext
): Promise<HTMLElement> {
  const { lang, content, hint } = diagram;
  const renderer = renderers[lang];
  const canonical = canonicalLang[lang] || lang;

  const figure = document.createElement("figure");
  figure.className = `diagram diagram-${canonical}`;
  figure.setAttribute("data-diagram", canonical);
  figure.setAttribute("data-source-base64", btoa(unescape(encodeURIComponent(content))));

  if (!renderer) {
    // Unknown renderer - show error
    figure.innerHTML = `
      <div class="diagram-error">
        <p>Unknown diagram type: ${lang}</p>
        <pre><code>${escapeHtml(content)}</code></pre>
      </div>
    `;
    return figure;
  }

  try {
    const result = await renderer.render(content, {
      ...ctx,
      formatHint: hint,
    });

    if (!result.data) {
      throw new Error("Empty render result");
    }

    let svg = typeof result.data === "string" ? result.data : await blobToText(result.data);
    svg = sanitizeSvg(svg);

    const size = parseSvgSize(svg);

    const hasForeignObject = /<foreignObject\b/i.test(svg);

    if (hasForeignObject) {
      const wrapper = document.createElement("div");
      wrapper.className = result.className || "diagram-img";
      wrapper.innerHTML = svg;
      const svgEl = wrapper.querySelector("svg");
      if (svgEl) {
        svgEl.setAttribute("width", String(size.width));
        svgEl.setAttribute("height", String(size.height));
        svgEl.style.maxWidth = "100%";
        svgEl.style.height = "auto";
      }
      figure.appendChild(wrapper);
    } else {
      const dataUrl = svgToDataUrl(svg);
      const img = document.createElement("img");
      img.src = dataUrl;
      img.width = size.width;
      img.height = size.height;
      img.alt = result.alt || `${canonical} diagram`;
      img.className = result.className || "diagram-img";
      figure.appendChild(img);
    }
  } catch (error) {
    // Render error - show error message with source
    const message = error instanceof Error ? error.message : String(error);
    figure.innerHTML = `
      <div class="diagram-error">
        <p>Error rendering ${lang} diagram: ${escapeHtml(message)}</p>
        <pre><code>${escapeHtml(content)}</code></pre>
      </div>
    `;
  }

  return figure;
}

/**
 * Convert a Blob to text.
 */
async function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read blob"));
    reader.readAsText(blob);
  });
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
