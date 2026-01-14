export type FenceOpening = {
  indent: string;
  markerChar: "`" | "~";
  markerLen: number;
  marker: string;
  info: string;
  lang: string;
  hint?: string;
};

export type FenceBlock = FenceOpening & {
  start: number;
  end: number;
  openLineStart: number;
  closeLineStart: number;
  content: string;
};

export function normalizeNewlines(md: string): string {
  return md.replace(/\r\n?/g, "\n");
}

export function parseFenceOpening(line: string): FenceOpening | null {
  const match = line.match(/^([ \t]*)(`{3,}|~{3,})(.*)$/);
  if (!match) return null;
  const indent = match[1];
  const marker = match[2];
  const markerChar = marker[0] === "~" ? "~" : "`";
  const markerLen = marker.length;
  const info = (match[3] || "").trim();
  const tokens = info ? info.split(/\s+/) : [];
  const lang = (tokens[0] || "").toLowerCase();
  const hint = tokens[1];
  return { indent, markerChar, markerLen, marker, info, lang, hint };
}

export function isFenceClosing(line: string, markerChar: "`" | "~", markerLen: number): boolean {
  const trimmed = line.trim();
  if (trimmed.length < markerLen) return false;
  for (let i = 0; i < trimmed.length; i += 1) {
    if (trimmed[i] !== markerChar) return false;
  }
  return true;
}

export function scanFencedBlocks(md: string): FenceBlock[] {
  const text = normalizeNewlines(md);
  const blocks: FenceBlock[] = [];
  let inFence = false;
  let open: FenceOpening | null = null;
  let openLineStart = 0;
  let contentStart = 0;
  let lineStart = 0;

  while (lineStart <= text.length) {
    const lineEnd = text.indexOf("\n", lineStart);
    const hasNewline = lineEnd !== -1;
    const line = hasNewline ? text.slice(lineStart, lineEnd) : text.slice(lineStart);
    const lineEndWithNewline = hasNewline ? lineEnd + 1 : text.length;

    if (!inFence) {
      const opening = parseFenceOpening(line);
      if (opening) {
        inFence = true;
        open = opening;
        openLineStart = lineStart;
        contentStart = lineEndWithNewline;
      }
    } else if (open && isFenceClosing(line, open.markerChar, open.markerLen)) {
      const contentEnd = lineStart;
      let content = text.slice(contentStart, contentEnd);
      if (content.endsWith("\n")) content = content.slice(0, -1);
      blocks.push({
        ...open,
        start: openLineStart,
        end: lineEndWithNewline,
        openLineStart,
        closeLineStart: lineStart,
        content,
      });
      inFence = false;
      open = null;
    }

    if (!hasNewline) break;
    lineStart = lineEndWithNewline;
  }

  return blocks;
}

export function unwrapMarkdownContainerFence(md: string): string {
  const normalized = normalizeNewlines(md);
  const trimmed = normalized.trim();
  if (!trimmed) return normalized;
  const blocks = scanFencedBlocks(trimmed);
  if (blocks.length !== 1) return normalized;
  const block = blocks[0];
  if (block.start !== 0 || block.end !== trimmed.length) return normalized;
  if (block.lang !== "markdown" && block.lang !== "md") return normalized;
  return block.content + "\n";
}
