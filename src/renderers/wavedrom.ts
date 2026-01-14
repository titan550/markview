import { parseSvgSize } from "../core/svg";
import type { Renderer } from "./types";

const wavedromScratch = document.createElement("div");
wavedromScratch.style.position = "fixed";
wavedromScratch.style.left = "-99999px";
wavedromScratch.style.top = "-99999px";
document.body.appendChild(wavedromScratch);

export const wavedromRenderer: Renderer = {
  name: "WaveDrom",
  async render(src) {
    // Known limitation: WaveDrom parsing expects JSON5-ish syntax (via JSON5 parser).
    if (!window.JSON5?.parse) throw new Error("JSON5 parser unavailable");
    if (!window.WaveDrom?.ProcessAll) throw new Error("WaveDrom is not available");
    const obj = window.JSON5.parse(src);
    const normalized = JSON.stringify(obj);
    wavedromScratch.innerHTML = "";
    const script = document.createElement("script");
    script.type = "WaveDrom";
    script.textContent = normalized;
    wavedromScratch.appendChild(script);
    window.WaveDrom.ProcessAll();
    const svgEl = wavedromScratch.querySelector("svg");
    if (!svgEl) throw new Error("WaveDrom output missing");
    const svg = new XMLSerializer().serializeToString(svgEl);
    const size = parseSvgSize(svg);
    return {
      mime: "image/svg+xml",
      data: svg,
      width: size.width,
      height: size.height,
      className: "diagram-img wavedrom-img",
      alt: "wavedrom diagram",
    };
  },
};
