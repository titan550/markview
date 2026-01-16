import { sanitizeMermaidSourceLabels } from "../core/mermaidSanitize";
import { injectSvgStyle, parseSvgSize } from "../core/svg";
import type { Renderer } from "./types";

let mermaidInitialized = false;
let mermaidId = 0;

function ensureMermaidInit(): void {
  if (mermaidInitialized) return;
  const mermaid = window.mermaid;
  if (!mermaid) throw new Error("Mermaid is not available");
  mermaid.initialize({
    startOnLoad: false,
    htmlLabels: true,
    markdownAutoWrap: true,
    wrap: true,
    flowchart: {
      htmlLabels: true,
      useMaxWidth: false,
      wrappingWidth: 400,
    },
  });
  mermaidInitialized = true;
}

export const mermaidRenderer: Renderer = {
  name: "Mermaid",
  async render(src) {
    ensureMermaidInit();
    const fontsReady = document.fonts?.ready;
    if (fontsReady) {
      await fontsReady.catch(() => undefined);
    }
    const mermaid = window.mermaid;
    if (!mermaid?.render) throw new Error("Mermaid is not available");
    const isERDiagram = /^\s*erDiagram\b/m.test(src);
    const cleaned = sanitizeMermaidSourceLabels(src, {
      lineBreak: "<br/>",
      preserveExisting: true,
      normalizeHtmlEntities: true,
      useNamedColon: true,
      useMarkdownStrings: true,
      wrapEdgeLabels: !isERDiagram,
    });

    const result = await mermaid.render(`mermaid-pre-${++mermaidId}`, cleaned);
    let svg = result?.svg || "";
    if (!svg) throw new Error("Mermaid output missing");
    if (isERDiagram) {
      svg = injectSvgStyle(svg, ".edgeLabel text{fill:#fff;}");
    }
    const size = parseSvgSize(svg);
    return {
      mime: "image/svg+xml",
      data: svg,
      width: size.width,
      height: size.height,
      className: "diagram-img mermaid-img",
      alt: "mermaid diagram",
    };
  },
};
