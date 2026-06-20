/**
 * Fenced code languages that markview renders as diagrams (including aliases).
 * Single source of truth shared by the markdown parser and the autofixer.
 */
export const DIAGRAM_LANGS = new Set([
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
