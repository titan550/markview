const XML_SAFE_ENTITIES = new Set(["amp", "lt", "gt", "quot", "apos"]);

const NAMED_TO_CODEPOINT: Record<string, number> = {
  nbsp: 160,
  thinsp: 8201,
  ensp: 8194,
  emsp: 8195,
  hellip: 8230,
};

export function sanitizeSvgForXml(svg: string): string {
  if (!svg || svg.indexOf("&") === -1) return svg;
  let out = svg;
  out = out.replace(/&amp;nbsp(?:;|\b)/gi, "&#160;");
  out = out.replace(/&nbsp(?![A-Za-z0-9])/gi, "&#160;");
  out = out.replace(/&([A-Za-z][A-Za-z0-9]+);/g, (full, nameRaw) => {
    const name = String(nameRaw).toLowerCase();
    if (XML_SAFE_ENTITIES.has(name)) return full;
    const cp = NAMED_TO_CODEPOINT[name];
    if (cp != null) return `&#${cp};`;
    return `&amp;${nameRaw};`;
  });
  out = out.replace(/<br(\s*)>/gi, "<br$1/>");
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return out;
  }

  const doc = new DOMParser().parseFromString(out, "image/svg+xml");
  if (doc.getElementsByTagName("parsererror").length) return out;

  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
  let prevText: Text | null = null;
  let node: Text | null = walker.nextNode() as Text | null;
  const prefixes = ["&nbsp", "&nbs", "&nb", "&n", "&"];
  while (node) {
    let value = node.nodeValue || "";
    value = value.replace(/\u00a0/g, " ").replace(/&nbsp;?/g, " ");
    if (prevText) {
      const prevValue = prevText.nodeValue || "";
      for (const prefix of prefixes) {
        if (!prevValue.endsWith(prefix)) continue;
        const needed = "&nbsp;".slice(prefix.length);
        if (needed && value.startsWith(needed)) {
          prevText.nodeValue = prevValue.slice(0, -prefix.length) + " ";
          value = value.slice(needed.length);
          break;
        }
      }
    }
    node.nodeValue = value;
    prevText = node;
    node = walker.nextNode() as Text | null;
  }

  return new XMLSerializer().serializeToString(doc);
}
