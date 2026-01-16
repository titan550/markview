/**
 * Clipboard utilities for copying markdown and HTML.
 */

/**
 * Copy text to clipboard.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: create temporary textarea
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Copy HTML to clipboard with both HTML and plain text representations.
 */
export async function copyHtmlFragment(html: string, plainFallback: string): Promise<boolean> {
  try {
    // Try modern clipboard API with HTML MIME type
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plainFallback], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
  } catch {
    // Fall through to text copy
  }

  // Fallback: copy as plain text
  return copyText(html);
}

/**
 * Read text from clipboard.
 */
export async function readClipboardText(): Promise<string> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return "";
  }
}

async function svgToPngBlob(svgEl: SVGSVGElement, scale = 2): Promise<Blob> {
  const bbox = svgEl.getBBox();
  const width = svgEl.width.baseVal.value || bbox.width || 800;
  const height = svgEl.height.baseVal.value || bbox.height || 600;

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.scale(scale, scale);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create PNG blob"));
          }
        },
        "image/png",
        1.0
      );
    };
    img.onerror = () => {
      reject(new Error("Failed to load SVG as image"));
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
  });
}

function inlineCodeBlockStyles(doc: Document, previewEl: HTMLElement): void {
  const preElements = doc.querySelectorAll("pre");
  const livePreElements = previewEl.querySelectorAll("pre");

  for (let i = 0; i < preElements.length; i++) {
    const pre = preElements[i] as HTMLElement;
    const livePre = livePreElements[i] as HTMLElement | undefined;

    let textColor = "#24292f";
    let fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

    if (livePre) {
      const computed = window.getComputedStyle(livePre);
      textColor = computed.color || textColor;
      fontFamily = computed.fontFamily || fontFamily;
    }

    const table = doc.createElement("table");
    table.setAttribute("cellpadding", "16");
    table.setAttribute("cellspacing", "0");
    table.setAttribute("border", "0");
    table.style.cssText = `
      width: 100%;
      background-color: #f6f8fa;
      border: 1px solid #d0d7de;
      border-collapse: collapse;
      margin: 16px 0;
    `
      .replace(/\s+/g, " ")
      .trim();

    const tr = doc.createElement("tr");
    const td = doc.createElement("td");
    td.style.cssText = `
      background-color: #f6f8fa;
      padding: 16px;
      font-family: ${fontFamily};
      font-size: 14px;
      line-height: 1.5;
      color: ${textColor};
      white-space: pre;
    `
      .replace(/\s+/g, " ")
      .trim();

    pre.style.cssText = `
      margin: 0;
      padding: 0;
      background: transparent;
      border: none;
      color: inherit;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      white-space: pre;
    `
      .replace(/\s+/g, " ")
      .trim();

    pre.parentNode?.insertBefore(table, pre);
    table.appendChild(tr);
    tr.appendChild(td);
    td.appendChild(pre);
  }

  const codeElements = doc.querySelectorAll("code:not(pre code)");

  for (const code of codeElements) {
    const codeEl = code as HTMLElement;
    codeEl.style.cssText = `
      background-color: rgba(175, 184, 193, 0.2);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9em;
      padding: 0.2em 0.4em;
      border-radius: 4px;
    `
      .replace(/\s+/g, " ")
      .trim();
  }

  const preCodeElements = doc.querySelectorAll("pre code");
  const livePreCodeElements = previewEl.querySelectorAll("pre code");

  for (let i = 0; i < preCodeElements.length; i++) {
    const code = preCodeElements[i] as HTMLElement;
    const liveCode = livePreCodeElements[i] as HTMLElement | undefined;

    let fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    if (liveCode) {
      const computed = window.getComputedStyle(liveCode);
      fontFamily = computed.fontFamily || fontFamily;
    }

    code.style.cssText = `
      font-family: ${fontFamily};
      font-size: inherit;
      background: transparent;
    `
      .replace(/\s+/g, " ")
      .trim();

    inlinePrismStyles(code, liveCode);
  }
}

function inlinePrismStyles(codeEl: HTMLElement, liveCodeEl?: HTMLElement): void {
  const spans = codeEl.querySelectorAll("span[class]");
  const liveSpans = liveCodeEl?.querySelectorAll("span[class]");

  for (let i = 0; i < spans.length; i++) {
    const span = spans[i] as HTMLElement;
    const liveSpan = liveSpans?.[i] as HTMLElement | undefined;

    if (liveSpan) {
      const computed = window.getComputedStyle(liveSpan);
      const color = computed.color;
      const fontWeight = computed.fontWeight;
      const fontStyle = computed.fontStyle;

      let style = "";
      if (color && color !== "rgb(0, 0, 0)") style += `color: ${color};`;
      if (fontWeight && fontWeight !== "400" && fontWeight !== "normal")
        style += `font-weight: ${fontWeight};`;
      if (fontStyle && fontStyle !== "normal") style += `font-style: ${fontStyle};`;

      if (style) {
        span.style.cssText = style;
      }
    }
  }
}

export async function prepareHtmlForClipboard(
  html: string,
  previewEl: HTMLElement
): Promise<string> {
  const doc = new DOMParser().parseFromString(html, "text/html");

  inlineCodeBlockStyles(doc, previewEl);

  const liveFigures = previewEl.querySelectorAll("figure.diagram");
  const docFigures = doc.querySelectorAll("figure.diagram");

  for (let i = 0; i < liveFigures.length; i++) {
    const liveFigure = liveFigures[i] as HTMLElement;
    const docFigure = docFigures[i];
    if (!docFigure) continue;

    let pngDataUrl: string | undefined;

    if (window.htmlToImage?.toPng) {
      pngDataUrl = await window.htmlToImage.toPng(liveFigure, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
    } else {
      const svgEl = liveFigure.querySelector("svg") as SVGSVGElement | null;
      if (svgEl) {
        const blob = await svgToPngBlob(svgEl, 2);
        pngDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read blob"));
          reader.readAsDataURL(blob);
        });
      }
    }

    if (pngDataUrl) {
      const img = doc.createElement("img");
      img.src = pngDataUrl;
      img.alt = "diagram";
      img.style.cssText = "max-width:100%;height:auto;";

      docFigure.innerHTML = "";
      docFigure.appendChild(img);
    }
  }

  return doc.body.innerHTML;
}
