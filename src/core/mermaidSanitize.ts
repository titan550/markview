export type MermaidSanitizeOptions = {
  lineBreak?: string;
  preserveExisting?: boolean;
  normalizeHtmlEntities?: boolean;
  useNamedColon?: boolean;
  useMarkdownStrings?: boolean;
  relaxed?: boolean;
};

export function sanitizeMermaidLabel(raw: string, opts: MermaidSanitizeOptions = {}): string {
  const {
    lineBreak = "<br/>",
    preserveExisting = true,
    normalizeHtmlEntities = true,
    useNamedColon = true,
    useMarkdownStrings = false,
    relaxed = false,
  } = opts;

  if (raw == null) return "";

  let s = String(raw);
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/\r\n?/g, "\n");

  function decodeNamedEntity(name: string): string | null {
    const map: Record<string, string> = {
      quot: '"',
      amp: "&",
      lt: "<",
      gt: ">",
      apos: "'",
      nbsp: " ",
      colon: ":",
    };
    return map[name] ?? null;
  }

  function decodeNumericEntity(num: string): string | null {
    const n = Number(num);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return String.fromCodePoint(n);
    } catch {
      return null;
    }
  }

  function decodeHexEntity(hex: string): string | null {
    const n = parseInt(hex, 16);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return String.fromCodePoint(n);
    } catch {
      return null;
    }
  }

  if (useMarkdownStrings || (!useMarkdownStrings && relaxed)) {
    s = s.replace(/#(\d{1,7});/g, (_, num) => decodeNumericEntity(num) ?? `#${num};`);
    s = s.replace(
      /#([A-Za-z][A-Za-z0-9]{1,31});/g,
      (_, name) => decodeNamedEntity(name) ?? `#${name};`
    );
    s = s.replace(/&#(\d+);/g, (_, num) => decodeNumericEntity(num) ?? `&#${num};`);
    s = s.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => decodeHexEntity(hex) ?? `&#x${hex};`);
    s = s.replace(/&([A-Za-z][A-Za-z0-9]+);/g, (_, name) => decodeNamedEntity(name) ?? `&${name};`);
  } else if (normalizeHtmlEntities) {
    s = s.replace(/&#(\d+);/g, "#$1;");
    s = s.replace(/&([A-Za-z][A-Za-z0-9]+);/g, "#$1;");
  }

  let reAlnum: RegExp;
  try {
    reAlnum = new RegExp("^[\\p{L}\\p{N}]$", "u");
  } catch {
    reAlnum = /^[A-Za-z0-9]$/;
  }

  const entityRe = /^#(?:\d{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/;

  function encodeChunk(chunk: string): string {
    let out = "";
    for (let i = 0; i < chunk.length; ) {
      if (preserveExisting && chunk[i] === "#") {
        const m = chunk.slice(i).match(entityRe);
        if (m) {
          out += m[0];
          i += m[0].length;
          continue;
        }
      }

      const cp = chunk.codePointAt(i) ?? 0;
      const ch = String.fromCodePoint(cp);
      const step = ch.length;

      if (!useMarkdownStrings && relaxed) {
        if (cp < 32) {
          out += `#${cp};`;
        } else if (ch === '"') {
          out += "#34;";
        } else {
          out += ch;
        }
        i += step;
        continue;
      }

      if (useMarkdownStrings) {
        if (ch === "`") {
          out += `#${cp};`;
        } else if (cp < 32) {
          out += `#${cp};`;
        } else {
          out += ch;
        }
      } else if (useNamedColon && ch === ":") {
        out += "#colon;";
      } else if (reAlnum.test(ch)) {
        out += ch;
      } else {
        out += `#${cp};`;
      }

      i += step;
    }
    return out;
  }

  return s.split("\n").map(encodeChunk).join(lineBreak);
}

export type MermaidSourceSanitizeOptions = MermaidSanitizeOptions & {
  useMarkdownStrings?: boolean;
  wrapEdgeLabels?: boolean;
  normalizeSpaceEntities?: boolean;
};

export function sanitizeMermaidSourceLabels(
  mermaidSource: string,
  opts: MermaidSourceSanitizeOptions = {}
): string {
  const { useMarkdownStrings = true, wrapEdgeLabels = true, normalizeSpaceEntities = true } = opts;
  const patterns = [
    { open: '(["', close: '"])' },
    { open: "(['", close: "'])" },
    { open: "([", close: "])" },
    { open: '{"', close: '"}' },
    { open: "{'", close: "'}" },
    { open: '["', close: '"]' },
    { open: "('", close: "')" },
    { open: '("', close: '")' },
    { open: "{{", close: "}}" },
  ];

  let src = String(mermaidSource ?? "");
  if (normalizeSpaceEntities) {
    src = src
      .replace(/&nbsp(?:;|\b)/gi, " ")
      .replace(/&#160(?:;|\b)/gi, " ")
      .replace(/&#xA0(?:;|\b)/gi, " ")
      .replace(/\u00a0/g, " ");
  }
  const firstLine = src.split("\n").find((line) => line.trim()) || "";
  const diagramType = firstLine.trim().split(/\s+/)[0].toLowerCase();
  const isERDiagram = diagramType === "erdiagram";
  const isSequenceDiagram = diagramType === "sequencediagram";
  const isStateDiagram = diagramType === "statediagram-v2" || diagramType === "statediagram";
  const preferPlainLabels = diagramType === "flowchart" || diagramType === "graph";
  const allowEdgeLabels = wrapEdgeLabels && !isERDiagram;
  const allowUnquotedNodeLabels = diagramType === "flowchart" || diagramType === "graph";
  let out = "";
  let i = 0;

  function sanitizeWithMode(inner: string, relaxedMode = preferPlainLabels): string {
    const trimmed = String(inner || "");
    const isWrappedMarkdown =
      trimmed.startsWith("`") && trimmed.endsWith("`") && !trimmed.slice(1, -1).includes("`");
    const core = isWrappedMarkdown ? trimmed.slice(1, -1) : trimmed;
    const useMarkdown =
      useMarkdownStrings && !preferPlainLabels && (isWrappedMarkdown || !core.includes("`"));
    const localOpts = {
      ...opts,
      useMarkdownStrings: useMarkdown,
      relaxed: relaxedMode,
      lineBreak: useMarkdown ? opts.lineBreak : "<br/>",
    };
    const cleaned = sanitizeMermaidLabel(core, localOpts);
    return useMarkdown ? "`" + cleaned + "`" : cleaned;
  }

  function sanitizeColonLabel(raw: string, quote: string): string {
    const trimmed = String(raw || "").trim();
    const isWrappedMarkdown =
      trimmed.startsWith("`") && trimmed.endsWith("`") && !trimmed.slice(1, -1).includes("`");
    const core = isWrappedMarkdown ? trimmed.slice(1, -1) : trimmed;
    const cleaned = sanitizeMermaidLabel(core, {
      ...opts,
      useMarkdownStrings: true,
      lineBreak: "<br/>",
    });
    if (quote === '"') return cleaned.replace(/"/g, "#quot;");
    if (quote === "'") return cleaned.replace(/'/g, "#39;");
    return cleaned;
  }

  function sanitizeColonLabels(srcText: string): string {
    return srcText.replace(
      /:\s*(`([^`]*?)`|"([^"]*?)"|'([^']*?)'|([^\n]*))/g,
      (_full, _g1, bt, dq, sq, raw) => {
        const text = bt ?? dq ?? sq ?? raw ?? "";
        const quote = bt ? "`" : dq ? '"' : sq ? "'" : "";
        const cleaned = sanitizeColonLabel(text.trim(), quote);
        return `: "${cleaned}"`;
      }
    );
  }

  if (isSequenceDiagram || isStateDiagram) {
    return sanitizeColonLabels(src);
  }

  function isEdgeLabelStart(pos: number): boolean {
    for (let j = pos - 1; j >= 0; j--) {
      const ch = src[j];
      if (ch === " " || ch === "\t") continue;
      return ch === "-" || ch === "=" || ch === "." || ch === ">";
    }
    return false;
  }

  function isLikelyNodeLabelStart(pos: number): boolean {
    for (let j = pos - 1; j >= 0; j--) {
      const ch = src[j];
      if (ch === " " || ch === "\t") continue;
      return /[\]A-Za-z0-9_})]/.test(ch);
    }
    return false;
  }

  while (i < src.length) {
    let p: { open: string; close: string } | null = null;
    for (const cand of patterns) {
      if (src.startsWith(cand.open, i)) {
        p = cand;
        break;
      }
    }

    if (p) {
      const start = i + p.open.length;
      const end = src.indexOf(p.close, start);
      if (end === -1) {
        out += src.slice(i);
        break;
      }
      const inner = src.slice(start, end);
      const wrapped = sanitizeWithMode(inner);
      out += p.open + wrapped + p.close;
      i = end + p.close.length;
      continue;
    }

    if (
      allowUnquotedNodeLabels &&
      (src[i] === "[" || src[i] === "(" || src[i] === "{") &&
      isLikelyNodeLabelStart(i)
    ) {
      const open = src[i];
      if (src[i + 1] === open) {
        out += src[i++];
        continue;
      }
      const close = open === "[" ? "]" : open === "(" ? ")" : "}";
      const start = i + 1;
      const end = src.indexOf(close, start);
      if (end === -1) {
        out += src.slice(i);
        break;
      }
      let inner = src.slice(start, end);
      if (inner.includes('"')) {
        inner = inner.replace(/"/g, "'");
      }
      const wrapped = sanitizeWithMode(inner);
      const quotedOpen = open + '"';
      const quotedClose = '"' + close;
      out += quotedOpen + wrapped + quotedClose;
      i = end + 1;
      continue;
    }

    if (allowEdgeLabels && src[i] === "|" && isEdgeLabelStart(i)) {
      const start = i + 1;
      const end = src.indexOf("|", start);
      if (end === -1) {
        out += src.slice(i);
        break;
      }
      const inner = src.slice(start, end);
      const wrapped = sanitizeWithMode(inner, false);
      out += "|" + wrapped + "|";
      i = end + 1;
      continue;
    }

    out += src[i++];
  }

  return out;
}
