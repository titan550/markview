export function parseSvgSize(svgText: string): { width: number; height: number } {
  const vbMatch = svgText.match(/viewBox=['"]([^'"]+)['"]/i);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const width = Math.max(1, Math.ceil(parts[2]));
      const height = Math.max(1, Math.ceil(parts[3]));
      return { width, height };
    }
  }

  const widthMatch = svgText.match(/width=['"]([^'"]+)['"]/i);
  const heightMatch = svgText.match(/height=['"]([^'"]+)['"]/i);
  if (widthMatch && heightMatch) {
    const width = Math.max(1, Math.ceil(parseFloat(widthMatch[1])));
    const height = Math.max(1, Math.ceil(parseFloat(heightMatch[1])));
    if (Number.isFinite(width) && Number.isFinite(height)) return { width, height };
  }

  return { width: 480, height: 240 };
}

export function parseSvgSizeWithUnit(
  svgText: string,
  basePx: number
): { width: number; height: number } | null {
  const widthMatch = svgText.match(/width="([^"]+)"/i);
  const heightMatch = svgText.match(/height="([^"]+)"/i);
  if (!widthMatch || !heightMatch) return null;

  function parseSize(value: string): number | null {
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return null;
    const unit = String(value)
      .replace(/[0-9.\s]/g, "")
      .toLowerCase();
    if (!unit || unit === "px") return num;
    if (unit === "em") return num * basePx;
    if (unit === "ex") return num * basePx * 0.5;
    if (unit === "in") return num * 96;
    if (unit === "pt") return num * (96 / 72);
    if (unit === "cm") return num * (96 / 2.54);
    if (unit === "mm") return num * (96 / 25.4);
    return null;
  }

  const width = parseSize(widthMatch[1]);
  const height = parseSize(heightMatch[1]);
  if (width === null || height === null) return null;
  return { width: Math.max(1, Math.ceil(width)), height: Math.max(1, Math.ceil(height)) };
}

export function injectSvgStyle(svgText: string, styleText: string): string {
  if (!styleText) return svgText;
  if (/<style[^>]*>/i.test(svgText)) {
    return svgText.replace(/<style[^>]*>/i, (m) => m + styleText);
  }
  return svgText.replace(/<svg\b[^>]*>/i, (m) => `${m}<style>${styleText}</style>`);
}

export function setSvgPixelSize(svgText: string, width: number, height: number): string {
  return svgText.replace(/<svg\b([^>]*)>/i, (_full, attrs) => {
    const next = attrs
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\sstyle="[^"]*"/i, "");
    return `<svg${next} width="${width}" height="${height}" style="width:${width}px;height:${height}px;">`;
  });
}

export function svgToDataUrl(svgText: string): string {
  const cleaned = svgText.replace(/<\?xml[^>]*\?>\s*/i, "");
  const encoded = encodeURIComponent(cleaned).replace(/'/g, "%27").replace(/"/g, "%22");
  return `data:image/svg+xml,${encoded}`;
}
