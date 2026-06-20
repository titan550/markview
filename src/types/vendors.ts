export type MermaidInitializeOptions = {
  startOnLoad?: boolean;
  htmlLabels?: boolean;
  markdownAutoWrap?: boolean;
  wrap?: boolean;
  wrapPadding?: number;
  flowchart?: {
    htmlLabels?: boolean;
    useMaxWidth?: boolean;
    wrappingWidth?: number;
  };
  sequence?: { htmlLabels?: boolean };
  gantt?: { htmlLabels?: boolean };
  [key: string]: unknown;
};

export type MermaidRenderResult = {
  svg: string;
};

export type MermaidAPI = {
  initialize: (opts: MermaidInitializeOptions) => void;
  render: (id: string, src: string) => Promise<MermaidRenderResult>;
};

export type MathJaxAPI = {
  tex2svg: (expr: string, opts: { display: boolean }) => Element;
  startup?: { promise?: Promise<unknown> };
};

export type TurndownRule = {
  filter: string | string[] | ((node: HTMLElement, options: unknown) => boolean);
  replacement: (content: string, node: HTMLElement, options: unknown) => string;
};

export type TurndownInstance = {
  turndown: (html: string) => string;
  addRule: (name: string, rule: TurndownRule) => TurndownInstance;
  use: (plugin: (td: TurndownInstance) => void) => TurndownInstance;
};

export type TurndownConstructor = new (opts: {
  headingStyle: string;
  codeBlockStyle: string;
  bulletListMarker: string;
}) => TurndownInstance;

export type VizInstance = {
  renderSVGElement: (src: string, opts?: { engine?: string }) => SVGElement;
};

export type VizGlobal = {
  instance: () => Promise<VizInstance>;
};

export type WaveDromGlobal = {
  ProcessAll: () => void;
};

export type VegaEmbedResult = {
  view: {
    toSVG: () => Promise<string>;
    toImageURL: (type: "png" | "svg", scale?: number) => Promise<string>;
    finalize: () => void;
  };
};

export type VegaEmbedFn = (
  el: HTMLElement,
  spec: unknown,
  opts: Record<string, unknown>
) => Promise<VegaEmbedResult>;

export type JSON5Global = {
  parse: (src: string) => unknown;
};

export type DOMPurifyGlobal = {
  sanitize: (dirty: string, config?: Record<string, unknown>) => string;
};

export type PrismGlobal = {
  highlightAllUnder: (el: HTMLElement) => void;
  highlightAll: () => void;
};

export type MarkdownItInstance = {
  render: (md: string) => string;
  renderInline: (md: string) => string;
};

// markdown-it is called as a function, not with `new`
export type MarkdownItFactory = (opts?: Record<string, unknown>) => MarkdownItInstance;

export type HtmlToImageOptions = {
  pixelRatio?: number;
  backgroundColor?: string;
  width?: number;
  height?: number;
  filter?: (node: Element) => boolean;
};

export type HtmlToImageGlobal = {
  toPng: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<string>;
  toBlob: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<Blob>;
  toSvg: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<string>;
  toCanvas: (node: HTMLElement, options?: HtmlToImageOptions) => Promise<HTMLCanvasElement>;
};

export type PakoGlobal = {
  deflateRaw: (data: Uint8Array, options?: { level?: number }) => Uint8Array;
  inflateRaw: (data: Uint8Array) => Uint8Array;
};

export type QRCode = {
  addData: (data: string) => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
  make: () => void;
};

export type QRCodeGeneratorFn = (typeNumber: number, errorCorrection: string) => QRCode;

export interface QRCodeGeneratorGlobal extends QRCodeGeneratorFn {
  stringToBytes: (s: string) => number[];
}

export type JsQRCode = {
  data: string;
  binaryData: number[];
  location: {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  };
};

export type JsQRFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" }
) => JsQRCode | null;
