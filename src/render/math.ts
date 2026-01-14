/**
 * Math rendering to embedded HTML elements with data URLs.
 * Uses MathJax tex2svg for rendering.
 */

import { sanitizeSvgForXml } from "../core/svgSanitize";
import { svgToDataUrl, parseSvgSize, parseSvgSizeWithUnit, setSvgPixelSize } from "../core/svg";
import type { MathRecord } from "../convert/markdownToHtml";

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
 * Sanitize SVG for security.
 */
function sanitizeSvg(svg: string): string {
  let result = sanitizeSvgForXml(svg);

  // Use DOMPurify if available
  if (window.DOMPurify) {
    result = window.DOMPurify.sanitize(result, {
      USE_PROFILES: { svg: true },
    });
  }

  return result;
}

/**
 * Render a math expression to an embedded HTML element.
 * Returns a <span> (inline) or <div> (block) element with:
 * - class: math math-inline or math math-block
 * - data-tex: original TeX source for round-trip
 * - data-math-mode: "inline" or "block"
 * - embedded <img> with data URL
 */
export async function renderMathToEmbeddedNode(record: MathRecord): Promise<HTMLElement> {
  const { mode, tex } = record;
  const isBlock = mode === "block";

  const wrapper = document.createElement(isBlock ? "div" : "span");
  wrapper.className = `math math-${mode}`;
  wrapper.setAttribute("data-tex", tex);
  wrapper.setAttribute("data-math-mode", mode);

  const mathJax = window.MathJax;
  if (!mathJax?.tex2svg) {
    // MathJax not available - show raw TeX
    wrapper.textContent = isBlock ? `$$${tex}$$` : `$${tex}$`;
    return wrapper;
  }

  try {
    // Wait for MathJax startup if needed
    if (mathJax.startup?.promise) {
      await mathJax.startup.promise.catch(() => undefined);
    }

    // Wait for fonts
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }

    // Render to SVG
    const svgNode = mathJax.tex2svg(tex, { display: isBlock });
    const svgEl = svgNode?.querySelector?.("svg");
    if (!svgEl) {
      throw new Error("MathJax produced no SVG output");
    }

    let svg = svgEl.outerHTML;
    svg = sanitizeSvg(svg);

    // Parse and set dimensions
    const basePx = parseFloat(getComputedStyle(document.body).fontSize) || 16;
    const size = parseSvgSizeWithUnit(svg, basePx) || parseSvgSize(svg);
    svg = setSvgPixelSize(svg, size.width, size.height);

    const dataUrl = svgToDataUrl(svg);

    const img = document.createElement("img");
    img.src = dataUrl;
    img.width = size.width;
    img.height = size.height;
    img.alt = "math";
    img.className = isBlock ? "math-img math-block" : "math-img";
    img.style.cssText = `width:${size.width}px;height:${size.height}px;`;

    wrapper.appendChild(img);
  } catch (error) {
    // Render error - show raw TeX
    const message = error instanceof Error ? error.message : String(error);
    console.warn("MathJax render failed:", message);
    wrapper.textContent = isBlock ? `$$${tex}$$` : `$${tex}$`;
    wrapper.title = `Math render error: ${message}`;
  }

  return wrapper;
}
