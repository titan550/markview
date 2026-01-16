import { describe, it, expect } from "vitest";
import {
  PLACEHOLDER_GIF,
  diagramPlaceholder,
  mathPlaceholder,
  isDiagramPlaceholder,
  isMathPlaceholder,
  parsePlaceholderId,
  parseMathMode,
} from "../placeholders";

describe("placeholder constants", () => {
  it("exports a valid data URL for placeholder GIF", () => {
    expect(PLACEHOLDER_GIF).toMatch(/^data:image\/gif;base64,/);
  });
});

describe("diagramPlaceholder", () => {
  it("creates markdown image with diagram: prefix in alt", () => {
    const result = diagramPlaceholder("0");
    expect(result).toBe(`![diagram:0](${PLACEHOLDER_GIF})`);
  });

  it("handles numeric string IDs", () => {
    const result = diagramPlaceholder("123");
    expect(result).toContain("diagram:123");
  });
});

describe("mathPlaceholder", () => {
  it("creates inline math placeholder with math-inline: prefix", () => {
    const result = mathPlaceholder("0", "inline");
    expect(result).toBe(`![math-inline:0](${PLACEHOLDER_GIF})`);
  });

  it("creates block math placeholder with math-block: prefix", () => {
    const result = mathPlaceholder("1", "block");
    expect(result).toBe(`![math-block:1](${PLACEHOLDER_GIF})`);
  });
});

describe("isDiagramPlaceholder", () => {
  it("returns true for img with diagram: alt", () => {
    const img = { alt: "diagram:0" } as HTMLImageElement;
    expect(isDiagramPlaceholder(img)).toBe(true);
  });

  it("returns false for img with math alt", () => {
    const img = { alt: "math-inline:0" } as HTMLImageElement;
    expect(isDiagramPlaceholder(img)).toBe(false);
  });

  it("returns false for img with no alt", () => {
    const img = {} as HTMLImageElement;
    expect(isDiagramPlaceholder(img)).toBe(false);
  });
});

describe("isMathPlaceholder", () => {
  it("returns true for math-inline placeholder", () => {
    const img = { alt: "math-inline:0" } as HTMLImageElement;
    expect(isMathPlaceholder(img)).toBe(true);
  });

  it("returns true for math-block placeholder", () => {
    const img = { alt: "math-block:1" } as HTMLImageElement;
    expect(isMathPlaceholder(img)).toBe(true);
  });

  it("returns false for diagram placeholder", () => {
    const img = { alt: "diagram:0" } as HTMLImageElement;
    expect(isMathPlaceholder(img)).toBe(false);
  });

  it("returns false for no alt", () => {
    const img = {} as HTMLImageElement;
    expect(isMathPlaceholder(img)).toBe(false);
  });
});

describe("parsePlaceholderId", () => {
  it("parses diagram ID", () => {
    const img = { alt: "diagram:42" } as HTMLImageElement;
    expect(parsePlaceholderId(img)).toBe("42");
  });

  it("parses math-inline ID", () => {
    const img = { alt: "math-inline:7" } as HTMLImageElement;
    expect(parsePlaceholderId(img)).toBe("7");
  });

  it("parses math-block ID", () => {
    const img = { alt: "math-block:99" } as HTMLImageElement;
    expect(parsePlaceholderId(img)).toBe("99");
  });

  it("returns null for invalid alt", () => {
    const img = { alt: "invalid" } as HTMLImageElement;
    expect(parsePlaceholderId(img)).toBe(null);
  });
});

describe("parseMathMode", () => {
  it("returns inline for math-inline placeholder", () => {
    const img = { alt: "math-inline:0" } as HTMLImageElement;
    expect(parseMathMode(img)).toBe("inline");
  });

  it("returns block for math-block placeholder", () => {
    const img = { alt: "math-block:0" } as HTMLImageElement;
    expect(parseMathMode(img)).toBe("block");
  });

  it("returns null for non-math placeholder", () => {
    const img = { alt: "diagram:0" } as HTMLImageElement;
    expect(parseMathMode(img)).toBe(null);
  });
});
