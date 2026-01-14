import { parseSvgSize } from "../core/svg";
import type { Renderer } from "./types";

const vegaScratch = document.createElement("div");
vegaScratch.style.position = "fixed";
vegaScratch.style.left = "-99999px";
vegaScratch.style.top = "-99999px";
document.body.appendChild(vegaScratch);

export const vegaLiteRenderer: Renderer = {
  name: "Vega-Lite",
  async render(src) {
    if (!window.vegaEmbed) throw new Error("Vega-Embed is not available");
    const parser = window.JSON5?.parse || JSON.parse;
    const spec = parser(src);
    vegaScratch.innerHTML = "";

    // Known limitation: Vega charts are exported as images (no interactivity).
    const res = await window.vegaEmbed(vegaScratch, spec, { actions: false, renderer: "svg" });
    const svg = await res.view.toSVG();
    res.view.finalize();
    const size = parseSvgSize(svg);
    return {
      mime: "image/svg+xml",
      data: svg,
      width: size.width,
      height: size.height,
      className: "diagram-img vega-img",
      alt: "vega-lite chart",
    };
  },
};
