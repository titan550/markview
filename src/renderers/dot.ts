import { parseSvgSize, parseSvgSizeWithUnit } from "../core/svg";
import type { Renderer } from "./types";
import type { VizInstance } from "../types/vendors";

let vizPromise: Promise<VizInstance> | null = null;

function getViz(): Promise<VizInstance> {
  if (!window.Viz?.instance) throw new Error("Viz.js is not available");
  vizPromise ??= window.Viz.instance();
  return vizPromise;
}

function stripFirstDirective(src: string, re: RegExp): { value: string | null; body: string } {
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const m = line.match(re);
    if (m) {
      lines.splice(i, 1);
      return { value: m[1], body: lines.join("\n") };
    }
    return { value: null, body: src };
  }
  return { value: null, body: src };
}

export const dotRenderer: Renderer = {
  name: "DOT",
  async render(src) {
    const { value: engine, body } = stripFirstDirective(
      src,
      /^\s*(?:\/\/|#)\s*engine:\s*([A-Za-z0-9_-]+)/i
    );
    const viz = await getViz();
    const svgEl = viz.renderSVGElement(body, engine ? { engine } : undefined);
    const svg = new XMLSerializer().serializeToString(svgEl);
    const size = parseSvgSizeWithUnit(svg, 16) || parseSvgSize(svg);
    return {
      mime: "image/svg+xml",
      data: svg,
      width: size.width,
      height: size.height,
      className: "diagram-img dot-img",
      alt: "dot diagram",
    };
  },
};
