export type RenderContext = {
  mdText: string;
  matchIndex: number;
  token: number;
  formatHint?: string;
};

export type RenderResult = {
  mime: string;
  data: string | Blob;
  width: number;
  height: number;
  className?: string;
  alt?: string;
};

export type Renderer = {
  name: string;
  render: (src: string, ctx: RenderContext) => Promise<RenderResult>;
};
