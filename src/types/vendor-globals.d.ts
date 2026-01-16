import type {
  MermaidAPI,
  MathJaxAPI,
  TurndownConstructor,
  VizGlobal,
  WaveDromGlobal,
  VegaEmbedFn,
  JSON5Global,
  DOMPurifyGlobal,
  PrismGlobal,
  MarkdownItFactory,
  HtmlToImageGlobal,
} from "./vendors";

declare global {
  interface Window {
    mermaid?: MermaidAPI;
    MathJax?: MathJaxAPI;
    TurndownService?: TurndownConstructor;
    Viz?: VizGlobal;
    WaveDrom?: WaveDromGlobal;
    vegaEmbed?: VegaEmbedFn;
    JSON5?: JSON5Global;
    DOMPurify?: DOMPurifyGlobal;
    Prism?: PrismGlobal;
    markdownit?: MarkdownItFactory;
    htmlToImage?: HtmlToImageGlobal;
  }
}

export {};
